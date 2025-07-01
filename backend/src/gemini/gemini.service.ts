import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

interface NaverSearchResponse {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: Array<{
    title: string;
    link: string;
    category: string;
    description: string;
    telephone: string;
    address: string;
    roadAddress: string;
    mapx: string;
    mapy: string;
  }>;
}

interface RestaurantData {
  name: string;
  address: string;
  telephone: string;
  category: string;
  lat: number;
  lng: number;
  distance: number;
  duration: number;
  link: string;
  description: string;
  representativeMenus?: string[];
  aiRecommendation: string;
}

interface DirectionResponse {
  route: {
    traoptimal: Array<{
      summary: {
        distance: number;
        duration: number;
      };
    }>;
  };
}

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }

  private async calculateRealDistance(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
  ): Promise<{ distance: number; duration: number }> {
    try {
      console.log(
        `🚗 Direction API 호출: ${startLat},${startLng} → ${endLat},${endLng}`,
      );

      const response = await axios.get<DirectionResponse>(
        'https://maps.apigw.ntruss.com/map-direction/v1/driving',
        {
          params: {
            start: `${startLng},${startLat}`,
            goal: `${endLng},${endLat}`,
            option: 'traoptimal',
          },
          headers: {
            'X-NCP-APIGW-API-KEY-ID': process.env.NCP_ACCESS_KEY_ID,
            'X-NCP-APIGW-API-KEY': process.env.NCP_SECRET_KEY,
          },

          timeout: 5000,
        },
      );

      if (response.data.route?.traoptimal?.[0]) {
        const route = response.data.route.traoptimal[0];
        const distance = route.summary.distance;
        const duration = Math.round(route.summary.duration / 1000 / 60);

        console.log(`✅ Direction API 성공: ${distance}m, ${duration}분`);
        return { distance, duration };
      }

      console.log('❌ Direction API 응답 없음');
      return { distance: 0, duration: 0 };
    } catch (error) {
      console.error('❌ Direction API 호출 실패:', error.message);
      return { distance: 0, duration: 0 };
    }
  }

  private async generateRestaurantInsights(
    restaurants: RestaurantData[],
    userLocation: string,
  ): Promise<RestaurantData[]> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
      });

      for (const restaurant of restaurants.slice(0, 3)) {
        try {
          const prompt = `
          음식점 정보:
          - 이름: ${restaurant.name}
          - 카테고리: ${restaurant.category}
          - 주소: ${restaurant.address}
          - 사용자 위치: ${userLocation}
          
          이 음식점을 추천하는 이유를 50자 이내로 간단하고 매력적으로 설명해주세요.
          예시: "신선한 재료로 만든 정통 한식, 현지인들이 자주 찾는 숨은 맛집"
        `;

          const result = await model.generateContent(prompt);
          const response = await result.response;
          restaurant.description = response.text().trim();

          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`❌ ${restaurant.name} 인사이트 생성 실패:`, error);
          const cuisine = this.extractCuisineType(restaurant.category);
          restaurant.description = `${cuisine} 카테고리의 추천 맛집`;
        }
      }

      for (let i = 3; i < restaurants.length; i++) {
        const cuisine = this.extractCuisineType(restaurants[i].category);
        restaurants[i].description = `${cuisine} 카테고리의 추천 맛집`;
      }

      return restaurants;
    } catch (error) {
      console.error('❌ AI 인사이트 생성 실패:', error);
      return restaurants.map((r) => ({
        ...r,
        description:
          r.description ||
          `${this.extractCuisineType(r.category)} 카테고리의 추천 맛집`,
      }));
    }
  }

  private async generateMainMenus(
    restaurant: RestaurantData,
  ): Promise<string[]> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
      });

      const prompt = `
    음식점 정보:
    - 상호명: ${restaurant.name}
    - 카테고리: ${restaurant.category}
    - 주소: ${restaurant.address}
    
    "${restaurant.name}"라는 음식점의 실제 대표메뉴 2-3개를 정확히 알려주세요.
    
    다음 형식으로만 답변해주세요:
    - 구체적인메뉴명1
    - 구체적인메뉴명2
    - 구체적인메뉴명3
    
    일반적인 카테고리명(한식, 양식 등)이 아닌 구체적인 메뉴명으로만 답변해주세요.
    `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const menus = text
        .split('\n')
        .filter((line) => line.trim().startsWith('-'))
        .map((line) => line.replace(/^-\s*/, '').trim())
        .filter((menu) => menu.length > 0 && menu.length < 20)
        .slice(0, 3);

      return menus;
    } catch (error) {
      console.error(`❌ ${restaurant.name} 메인메뉴 생성 실패:`, error);
      return [];
    }
  }

  async getRestaurantsByAddress(
    address: string,
    userLat?: number,
    userLng?: number,
  ) {
    try {
      console.log('🏠 주소 기반 음식점 검색 시작');
      console.log(`   주소: ${address}`);
      console.log(`   사용자 좌표: ${userLat}, ${userLng}`);

      if (!address || address.trim() === '') {
        console.log('❌ 주소가 비어있습니다');
        return [];
      }

      const locationInfo = this.extractLocationFromAddress(address);
      console.log('📍 추출된 지역 정보:', locationInfo);

      const aiKeywords = await this.generateKeywordsByAddress(
        address,
        locationInfo,
      );

      const restaurants = await this.searchRestaurantsByAddress(
        address,
        aiKeywords,
        userLat,
        userLng,
      );

      if (restaurants.length === 0) {
        console.log('❌ 주소 기반 검색 결과가 없습니다.');
        return [];
      }

      const restaurantsWithInsights = await this.generateRestaurantInsights(
        restaurants,
        address,
      );

      console.log('🍽️ 메인메뉴 생성 시작...');
      for (const restaurant of restaurantsWithInsights.slice(0, 3)) {
        restaurant.representativeMenus =
          await this.generateMainMenus(restaurant);

        if (restaurant.representativeMenus.length === 0) {
          console.log(`   ${restaurant.name}: 메뉴 정보 없음`);
        } else {
          console.log(
            `   ${restaurant.name}: ${restaurant.representativeMenus.join(', ')}`,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      for (let i = 3; i < restaurantsWithInsights.length; i++) {
        restaurantsWithInsights[i].representativeMenus = [];
      }

      const formattedResults = restaurantsWithInsights.map(
        (restaurant, index) => ({
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
            userLat && userLng && restaurant.duration > 0
              ? `${
                  restaurant.distance < 1000
                    ? restaurant.distance + 'm'
                    : (restaurant.distance / 1000).toFixed(1) + 'km'
                } (도보 ${restaurant.duration}분)`
              : '주소 기반 검색',
          lat: restaurant.lat,
          lng: restaurant.lng,
          representativeMenus: restaurant.representativeMenus || [],
        }),
      );

      console.log(
        `✅ 주소 기반 추천 완료: ${formattedResults.length}개 음식점`,
      );
      return formattedResults;
    } catch (error) {
      console.error('❌ 주소 기반 검색 실패:', error);
      return [];
    }
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

  private async generateKeywordsByAddress(
    address: string,
    locationInfo: any,
  ): Promise<string[]> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
      });

      const prompt = `
      주소: ${address}
      지역: ${locationInfo.city} ${locationInfo.district} ${locationInfo.dong}
      
      이 지역에서 검색할 음식점 키워드를 정확히 다음 형식으로만 답변해주세요:
      
      - 한식
      - 카페
      - 치킨
      - 피자
      - 중식
      - 일식
      
      위 예시처럼 음식점 종류만 간단히 나열해주세요. 설명은 하지 마세요.
    `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const keywords = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('-') || line.startsWith('•'))
        .map((line) => line.replace(/^[-•]\s*/, '').trim())
        .filter((keyword) => keyword.length > 0 && keyword.length < 20)
        .slice(0, 6);

      if (keywords.length === 0) {
        console.log('⚠️ AI 키워드 추출 실패, 기본 키워드 사용');
        return ['한식', '카페', '치킨', '피자', '중식'];
      }

      return keywords;
    } catch (error) {
      console.error('❌ AI 키워드 생성 실패:', error);
      return ['한식', '카페', '치킨', '피자', '중식'];
    }
  }

  private async searchRestaurantsByAddress(
    address: string,
    keywords: string[],
    userLat?: number,
    userLng?: number,
  ): Promise<RestaurantData[]> {
    try {
      let allRestaurants: RestaurantData[] = [];

      for (const keyword of keywords) {
        try {
          console.log(`🔍 "${address} ${keyword}" 검색 중...`);

          const response = await axios.get<NaverSearchResponse>(
            'https://openapi.naver.com/v1/search/local.json',
            {
              params: {
                query: `${address} ${keyword}`,
                display: 5,
                start: 1,
                sort: 'comment',
              },
              headers: {
                'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
                'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
              },
              responseType: 'json',
              responseEncoding: 'utf8',
              timeout: 10000,
            },
          );

          if (response.data.items && response.data.items.length > 0) {
            const restaurantsData: RestaurantData[] = [];

            for (const item of response.data.items.filter(
              (item) => item.category && item.category.includes('음식점'),
            )) {
              const itemLat = parseFloat(item.mapy) / 10000000;
              const itemLng = parseFloat(item.mapx) / 10000000;

              let distance = 0;
              let duration = 0;

              if (userLat && userLng) {
                console.log(`🚗 Direction API 호출: ${item.title}`);
                const result = await this.calculateRealDistance(
                  userLat,
                  userLng,
                  itemLat,
                  itemLng,
                );
                distance = result.distance;
                duration = result.duration;

                await new Promise((resolve) => setTimeout(resolve, 100));
              }

              restaurantsData.push({
                name: this.decodeHtmlEntities(
                  item.title.replace(/<[^>]*>/g, ''),
                ),
                address: this.decodeHtmlEntities(
                  item.roadAddress || item.address,
                ),
                telephone: item.telephone || '',
                category: item.category,
                lat: itemLat,
                lng: itemLng,
                distance: distance,
                duration: duration,
                link: item.link,
                description: item.description || '',
                aiRecommendation: keyword,
              });
            }

            allRestaurants.push(...restaurantsData);
          }

          await new Promise((resolve) => setTimeout(resolve, 800));
        } catch (queryError) {
          console.error(`❌ "${keyword}" 검색 실패:`, queryError.message);
          continue;
        }
      }

      const uniqueRestaurants = allRestaurants.filter(
        (restaurant, index, self) =>
          index ===
          self.findIndex(
            (r) =>
              r.name === restaurant.name && r.address === restaurant.address,
          ),
      );

      if (userLat && userLng) {
        const restaurantsWithDistance = uniqueRestaurants.filter(
          (r) => r.distance > 0,
        );
        if (restaurantsWithDistance.length > 0) {
          return restaurantsWithDistance
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5);
        }
      }

      return uniqueRestaurants.slice(0, 5);
    } catch (error) {
      console.error('❌ 주소 기반 검색 실패:', error);
      throw new Error('주소 기반 음식점 검색에 실패했습니다.');
    }
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

  private decodeHtmlEntities(text: string): string {
    const entities = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#x27;': "'",
      '&#x2F;': '/',
      '&#39;': "'",
      '&nbsp;': ' ',
      '&apos;': "'",
    };

    return text.replace(/&[#\w]+;/g, (entity) => {
      return entities[entity] || entity;
    });
  }

  async searchPlaces(query: string) {
    try {
      console.log(`🔍 네이버 지역검색 API로 "${query}" 검색 중...`);

      const response = await axios.get<NaverSearchResponse>(
        'https://openapi.naver.com/v1/search/local.json',
        {
          params: {
            query: query,
            display: 10,
            start: 1,
            sort: 'random',
          },
          headers: {
            'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
            'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
          },
          responseType: 'json',
          responseEncoding: 'utf8',
          timeout: 10000,
        },
      );

      const places = response.data.items.map((item) => ({
        title: this.decodeHtmlEntities(item.title.replace(/<[^>]*>/g, '')),
        roadAddress: this.decodeHtmlEntities(item.roadAddress || ''),
        address: this.decodeHtmlEntities(item.address || ''),
        mapx: item.mapx,
        mapy: item.mapy,
        category: item.category,
      }));

      return places;
    } catch (error) {
      console.error('❌ 장소 검색 실패:', error);
      return [];
    }
  }
}
