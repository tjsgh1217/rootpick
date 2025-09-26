import { Injectable } from '@nestjs/common';
import {
  NaverSearchService,
  RestaurantSearchResult,
} from './naver-search.service';
import { NaverDirectionService } from './naver-direction.service';
import { OpenAiService } from './open-ai.service';

interface RestaurantData extends RestaurantSearchResult {
  distance: number;
  duration: number;
  representativeMenus: string[];
}

@Injectable()
export class RestaurantService {
  constructor(
    private naverSearchService: NaverSearchService,
    private naverDirectionService: NaverDirectionService,
    private geminiAiService: OpenAiService,
  ) {}

  async getRestaurantsByAddress(
    address: string,
    userLat?: number,
    userLng?: number,
  ) {
    try {
      // console.log('🏠 주소 기반 음식점 검색 시작');
      // console.log(`   주소: ${address}`);
      // console.log(`   사용자 좌표: ${userLat}, ${userLng}`);

      if (!address || address.trim() === '') {
        // console.log('❌ 주소가 비어있습니다');
        return [];
      }

      const locationInfo = this.extractLocationFromAddress(address);
      // console.log('📍 추출된 지역 정보:', locationInfo);

      const aiKeywords = await this.geminiAiService.generateKeywordsByAddress(
        address,
        locationInfo,
      );

      const searchResults =
        await this.naverSearchService.searchRestaurantsByAddress(
          address,
          aiKeywords,
        );

      if (searchResults.length === 0) {
        // console.log('❌ 주소 기반 검색 결과가 없습니다.');
        return [];
      }

      let restaurants: RestaurantData[] = searchResults.map((r) => ({
        ...r,
        distance: 0,
        duration: 0,
        representativeMenus: [],
      }));

      if (userLat && userLng) {
        const distanceResults =
          await this.naverDirectionService.calculateDistancesForRestaurants(
            userLat,
            userLng,
            restaurants,
          );

        restaurants = restaurants.map((restaurant, index) => ({
          ...restaurant,
          distance: distanceResults[index].distance,
          duration: distanceResults[index].duration,
        }));

        restaurants = restaurants
          .filter((r) => r.distance > 0)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 10);
      }

      const restaurantsWithInsights = restaurants.map((restaurant) => ({
        ...restaurant,
        description:
          restaurant.description ||
          `${this.extractCuisineType(restaurant.category)} 카테고리의 추천 맛집`,
      }));

      // console.log('��️ 메인메뉴 생성 시작...');

      async function asyncPool<T, R>(
        poolLimit: number,
        array: T[],
        iteratorFn: (item: T, idx: number) => Promise<R>,
      ): Promise<R[]> {
        const ret: R[] = [];
        const executing: Promise<void>[] = [];
        for (let i = 0; i < array.length; i++) {
          const p = iteratorFn(array[i], i).then((res) => {
            ret[i] = res;
          });
          executing.push(p);
          if (executing.length >= poolLimit) {
            await Promise.race(executing);
            executing.splice(
              executing.findIndex((e) => e === p),
              1,
            );
          }
        }
        await Promise.all(executing);
        return ret;
      }

      await asyncPool(3, restaurantsWithInsights, async (restaurant) => {
        restaurant.representativeMenus =
          await this.geminiAiService.generateMainMenus(restaurant);

        if (restaurant.representativeMenus.length === 0) {
          // console.log(`   ${restaurant.name}: 메뉴 정보 없음`);
        } else {
          // console.log(
          //   `   ${restaurant.name}: ${restaurant.representativeMenus.join(', ')}`,
          // );
        }
      });

      const formattedResults = restaurantsWithInsights.map(
        (restaurant, index) => {
          const isValidDistance =
            typeof restaurant.distance === 'number' &&
            !isNaN(restaurant.distance);
          const walkDuration = isValidDistance
            ? Math.round(restaurant.distance / 75)
            : null;
          const carDuration =
            restaurant.duration > 0 ? `${restaurant.duration}분` : '1분 미만';
          return {
            id: index + 1,
            name: restaurant.name,
            address: restaurant.address,
            category: restaurant.category,
            telephone: restaurant.telephone || '',
            description: restaurant.description,
            link: restaurant.link,
            cuisine: this.extractCuisineType(restaurant.category),
            area: this.extractAreaFromAddress(restaurant.address),
            displayDistance:
              userLat && userLng && isValidDistance
                ? `${
                    restaurant.distance < 1000
                      ? restaurant.distance + 'm'
                      : (restaurant.distance / 1000).toFixed(1) + 'km'
                  } (차량 ${carDuration}, 도보 약 ${walkDuration ?? '정보 없음'}분)`
                : '거리 정보 없음',
            lat: restaurant.lat,
            lng: restaurant.lng,
            representativeMenus: restaurant.representativeMenus || [],
          };
        },
      );

      // console.log(
      //   `✅ 주소 기반 추천 완료: ${formattedResults.length}개 음식점`,
      // );
      return formattedResults;
    } catch (error) {
      // console.error('❌ 주소 기반 검색 실패:', error);
      return [];
    }
  }

  async searchPlaces(query: string) {
    return this.naverSearchService.searchPlaces(query);
  }

  private extractLocationFromAddress(address: string): {
    city: string;
    district: string;
    dong: string;
  } {
    const cityMatch = address.match(/(.*?[시군])/);
    const districtMatch = address.match(/([가-힣]+구)/);
    const dongMatch = address.match(/([가-힣]+동)/);

    return {
      city: cityMatch ? cityMatch[1] : '',
      district: districtMatch ? districtMatch[1] : '',
      dong: dongMatch ? dongMatch[1] : '',
    };
  }

  private extractCuisineType(category: string): string {
    const cleanCategory = category.startsWith('음식점>')
      ? category.substring(4)
      : category;

    if (cleanCategory.includes('한식')) return '한식';
    if (cleanCategory.includes('중식')) return '중식';
    if (cleanCategory.includes('일식')) return '일식';
    if (cleanCategory.includes('양식')) return '양식';
    if (cleanCategory.includes('아시아음식')) return '아시아음식';
    if (cleanCategory.includes('치킨')) return '치킨';
    if (cleanCategory.includes('피자')) return '피자';
    if (cleanCategory.includes('카페')) return '카페';
    if (cleanCategory.includes('분식')) return '분식';

    return cleanCategory.split('>').pop() || cleanCategory;
  }

  private extractAreaFromAddress(address: string): string {
    const match = address.match(/(.*?[시군구])/);
    return match ? match[1] : '';
  }
}
