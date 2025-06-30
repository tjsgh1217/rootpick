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
  link: string;
  description: string;
  aiRecommendation?: string;
  representativeMenus?: string[];
}

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }

  private async generateAIKeywords(
    lat: number,
    lng: number,
    address: string,
  ): Promise<string[]> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
      });

      const prompt = `
        위치 정보:
        - 위도: ${lat}
        - 경도: ${lng}
        - 주소: ${address}
        
        이 위치 주변에서 추천할 만한 음식점 종류와 특징을 분석해주세요.
        다음 형식으로 5-8개의 검색 키워드를 제안해주세요:
        
        예시:
        - "한식 맛집"
        - "이탈리안 레스토랑"
        - "카페 디저트"
        - "치킨 전문점"
        
        해당 지역의 특성을 고려하여 실제로 있을 법한 음식점 유형을 추천해주세요.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const keywords = text
        .split('\n')
        .filter((line) => line.includes('-') || line.includes('•'))
        .map((line) => line.replace(/[-•]/g, '').replace(/"/g, '').trim())
        .filter((keyword) => keyword.length > 0)
        .slice(0, 6);

      console.log('🤖 Gemini AI 추천 키워드:', keywords);
      return keywords.length > 0
        ? keywords
        : ['맛집', '음식점', '카페', '레스토랑'];
    } catch (error) {
      console.error('❌ Gemini AI 키워드 생성 실패:', error);
      return ['맛집', '음식점', '카페', '레스토랑', '한식', '치킨'];
    }
  }

  private async searchRestaurantsByKeywords(
    lat: number,
    lng: number,
    keywords: string[],
  ): Promise<RestaurantData[]> {
    try {
      let allRestaurants: RestaurantData[] = [];

      for (const keyword of keywords) {
        try {
          console.log(`🔍 "${keyword}" 검색 중...`);

          const response = await axios.get<NaverSearchResponse>(
            'https://openapi.naver.com/v1/search/local.json',
            {
              params: {
                query: keyword,
                display: 30,
                start: 1,
                sort: 'distance',
              },
              headers: {
                'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
                'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
              },
              timeout: 10000,
            },
          );

          if (response.data.items && response.data.items.length > 0) {
            const restaurantsWithDistance: RestaurantData[] =
              response.data.items
                .map((item) => {
                  const itemLat = parseFloat(item.mapy) / 10000000;
                  const itemLng = parseFloat(item.mapx) / 10000000;
                  const distance = this.calculateDistance(
                    lat,
                    lng,
                    itemLat,
                    itemLng,
                  );

                  return {
                    name: item.title.replace(/<[^>]*>/g, ''),
                    address: item.roadAddress || item.address,
                    telephone: item.telephone || '',
                    category: item.category,
                    lat: itemLat,
                    lng: itemLng,
                    distance: Math.round(distance),
                    link: item.link,
                    description: item.description || '',
                    aiRecommendation: keyword,
                  };
                })
                .filter((restaurant) => restaurant.distance <= 2000)
                .sort((a, b) => a.distance - b.distance);

            allRestaurants.push(...restaurantsWithDistance);
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (queryError) {
          console.error(`❌ "${keyword}" 검색 실패:`, queryError.message);

          if (queryError.response?.status === 429) {
            console.log('⏳ Rate Limit 대기 중...');
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }

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

      return uniqueRestaurants
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 20);
    } catch (error) {
      console.error('❌ 키워드 기반 검색 실패:', error);
      throw new Error('음식점 검색에 실패했습니다.');
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

      for (const restaurant of restaurants.slice(0, 10)) {
        try {
          const prompt = `
            음식점 정보:
            - 이름: ${restaurant.name}
            - 카테고리: ${restaurant.category}
            - 주소: ${restaurant.address}
            - 거리: ${restaurant.distance}m
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
          restaurant.description = `${restaurant.aiRecommendation} 카테고리의 추천 맛집`;
        }
      }

      for (let i = 10; i < restaurants.length; i++) {
        restaurants[i].description =
          `${restaurants[i].aiRecommendation} 카테고리의 추천 맛집`;
      }

      return restaurants;
    } catch (error) {
      console.error('❌ AI 인사이트 생성 실패:', error);
      return restaurants.map((r) => ({
        ...r,
        description:
          r.description || `${r.aiRecommendation} 카테고리의 추천 맛집`,
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
    
    만약 이 음식점이 실제 체인점이나 유명한 브랜드라면:
    - 해당 브랜드에서 가장 인기 있는 실제 메뉴를 알려주세요
    - 예: 교촌치킨 → 교촌허니콤보, 교촌레드콤보
    - 예: BBQ → 황금올리브치킨, 자메이카통다리구이
    - 예: 맥도날드 → 빅맥, 상하이버거, 맥너겟
    - 예: 스타벅스 → 아메리카노, 카라멜마키아토, 프라푸치노
    
    만약 개인 음식점이라면:
    - 카테고리와 음식점명을 참고하여 그 음식점에서 실제로 팔 것 같은 구체적인 메뉴를 추천해주세요
    - 예: "김치찌개집" → 김치찌개, 된장찌개, 제육볶음
    - 예: "할머니국수" → 잔치국수, 비빔국수, 만두
    
    다음 형식으로만 답변해주세요:
    - 구체적인메뉴명1
    - 구체적인메뉴명2
    - 구체적인메뉴명3
    
    일반적인 카테고리명(한식, 양식 등)이 아닌 구체적인 메뉴명으로만 답변해주세요.
    만약 정확한 메뉴를 모르겠다면 "알 수 없음"이라고 답변해주세요.
    `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log(`🍽️ ${restaurant.name} AI 메뉴 응답:`, text);

      if (
        text.includes('알 수 없음') ||
        text.includes('모르겠') ||
        text.includes('정보가 없')
      ) {
        console.log(`❓ ${restaurant.name} AI가 메뉴 정보 없음으로 응답`);
        return [];
      }

      const menus = text
        .split('\n')
        .filter((line) => line.trim().startsWith('-'))
        .map((line) => line.replace(/^-\s*/, '').trim())
        .filter((menu) => menu.length > 0 && menu.length < 20)
        .slice(0, 3);

      console.log(`🍽️ ${restaurant.name} 추출된 메뉴:`, menus);

      if (menus.length === 0) {
        console.log(`❌ ${restaurant.name} 메뉴 추출 실패 - 빈 배열 반환`);
        return [];
      }

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
      for (const restaurant of restaurantsWithInsights) {
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

      const formattedResults = restaurantsWithInsights.map(
        (restaurant, index) => ({
          id: index + 1,
          name: restaurant.name,
          address: restaurant.address,
          category: restaurant.category,
          telephone: restaurant.telephone || '',
          description: restaurant.description,
          aiRecommendation: restaurant.aiRecommendation,
          link: restaurant.link,
          cuisine: this.extractCuisineType(restaurant.category),
          rating: null,
          area: this.extractAreaFromAddress(restaurant.address),
          displayDistance: '주소 기반 검색',
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

      console.log('🤖 AI 원본 응답:', text);

      const keywords = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('-') || line.startsWith('•'))
        .map((line) => line.replace(/^[-•]\s*/, '').trim())
        .filter((keyword) => keyword.length > 0 && keyword.length < 20)
        .slice(0, 6);

      console.log('🤖 추출된 키워드:', keywords);

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
                display: 25,
                start: 1,
                sort: 'comment',
              },
              headers: {
                'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
                'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
              },
              timeout: 10000,
            },
          );

          console.log(
            `✅ "${keyword}" 검색 결과: ${response.data.items?.length || 0}개`,
          );

          if (response.data.items && response.data.items.length > 0) {
            const restaurantsData: RestaurantData[] = response.data.items
              .filter(
                (item) => item.category && item.category.includes('음식점'),
              )
              .map((item) => ({
                name: item.title.replace(/<[^>]*>/g, ''),
                address: item.roadAddress || item.address,
                telephone: item.telephone || '',
                category: item.category,
                lat: parseFloat(item.mapy) / 10000000,
                lng: parseFloat(item.mapx) / 10000000,
                distance: 0,
                link: item.link,
                description: item.description || '',
                aiRecommendation: keyword,
              }));

            allRestaurants.push(...restaurantsData);
          }

          await new Promise((resolve) => setTimeout(resolve, 800));
        } catch (queryError) {
          console.error(`❌ "${keyword}" 검색 실패:`, queryError.message);

          if (queryError.response?.status === 429) {
            console.log('⏳ Rate Limit 대기 중...');
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }

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

      return uniqueRestaurants.slice(0, 20);
    } catch (error) {
      console.error('❌ 주소 기반 검색 실패:', error);
      throw new Error('주소 기반 음식점 검색에 실패했습니다.');
    }
  }

  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private extractCuisineType(category: string): string {
    if (category.includes('한식')) return '한식';
    if (category.includes('중식')) return '중식';
    if (category.includes('일식')) return '일식';
    if (category.includes('양식')) return '양식';
    if (category.includes('치킨')) return '치킨';
    if (category.includes('피자')) return '피자';
    if (category.includes('카페')) return '카페';
    if (category.includes('분식')) return '분식';
    return category;
  }

  private extractAreaFromAddress(address: string): string {
    const match = address.match(/(.*?[시군구])/);
    return match ? match[1] : '';
  }

  async getAIRestaurantRecommendations(
    lat: number,
    lng: number,
    address: string,
  ) {
    try {
      console.log('🤖 AI 기반 음식점 추천 시작');
      console.log(`   위치: ${address} (${lat}, ${lng})`);

      const aiKeywords = await this.generateAIKeywords(lat, lng, address);

      const restaurants = await this.searchRestaurantsByKeywords(
        lat,
        lng,
        aiKeywords,
      );

      if (restaurants.length === 0) {
        console.log('❌ AI 추천 결과가 없습니다.');
        return [];
      }

      const restaurantsWithInsights = await this.generateRestaurantInsights(
        restaurants,
        address,
      );

      const formattedResults = restaurantsWithInsights.map(
        (restaurant, index) => {
          const displayDistance =
            restaurant.distance >= 1000
              ? `${(restaurant.distance / 1000).toFixed(1)}km`
              : `${restaurant.distance}m`;

          return {
            id: index + 1,
            name: restaurant.name,
            distance: restaurant.distance,
            displayDistance: displayDistance,
            lat: restaurant.lat,
            lng: restaurant.lng,
            address: restaurant.address,
            category: restaurant.category,
            telephone: restaurant.telephone || '',
            description: restaurant.description,
            aiRecommendation: restaurant.aiRecommendation,
            link: restaurant.link,
            cuisine: this.extractCuisineType(restaurant.category),
            rating: null,
            area: this.extractAreaFromAddress(restaurant.address),
          };
        },
      );

      console.log(`✅ AI 추천 완료: ${formattedResults.length}개 음식점`);
      return formattedResults;
    } catch (error) {
      console.error('❌ AI 기반 추천 실패:', error);
      return [];
    }
  }

  async getRestaurantRecommendations(
    lat: number,
    lng: number,
    address?: string,
  ) {
    console.log(
      '⚠️ getRestaurantRecommendations는 deprecated입니다. getAIRestaurantRecommendations를 사용하세요.',
    );
    return this.getAIRestaurantRecommendations(
      lat,
      lng,
      address || `위도 ${lat}, 경도 ${lng}`,
    );
  }

  async getDetailedReview(
    name: string,
    location: string,
    category?: string,
    aiRecommendation?: string,
  ): Promise<string> {
    try {
      const blogReviews = await this.getRestaurantReviewsFromBlog(
        name,
        location,
      );

      if (blogReviews.length > 0) {
        const model = this.genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
        });

        const prompt = `
        음식점: ${name}
        위치: ${location}
        카테고리: ${category || '일반 음식점'}
        
        다음은 실제 블로그 리뷰들입니다:
        ${blogReviews.map((review, index) => `${index + 1}. ${review}`).join('\n')}
        
        위 리뷰들을 종합하여 이 음식점에 대한 객관적이고 유용한 분석을 작성해주세요.
        긍정적인 점과 주의할 점을 균형있게 포함하여 150-200자로 작성해주세요.
      `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
      }

      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
      });

      const prompt = `
      음식점: ${name}
      위치: ${location}
      카테고리: ${category || '일반 음식점'}
      AI 추천 이유: ${aiRecommendation || '정보 없음'}
      
      이 음식점에 대한 현실적이고 유용한 AI 분석을 작성해주세요.
      위치의 특성과 카테고리를 고려하여 150-200자로 작성해주세요.
    `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('❌ AI 리뷰 생성 실패:', error);

      return `${name}에 대한 리뷰 정보를 현재 확인할 수 없습니다. ${location} 지역의 ${category || '음식점'}으로 직접 방문을 통한 확인을 권장합니다.`;
    }
  }

  private async getRestaurantReviewsFromBlog(
    restaurantName: string,
    location: string,
  ): Promise<string[]> {
    try {
      if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
        console.warn('네이버 API 키가 설정되지 않았습니다.');
        return [];
      }

      const query = `${restaurantName} ${location} 리뷰 후기 맛집`;

      const response = await axios.get(
        'https://openapi.naver.com/v1/search/blog.json',
        {
          params: {
            query: encodeURIComponent(query),
            display: 10,
            sort: 'sim',
          },
          headers: {
            'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
            'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
          },
          timeout: 5000,
        },
      );

      const reviews =
        response.data.items
          ?.map((item) => {
            const cleanDescription = item.description
              .replace(/<[^>]*>/g, '')
              .replace(/&[^;]+;/g, '')
              .trim();

            return cleanDescription;
          })
          .filter(
            (desc) =>
              desc.length > 30 &&
              desc.length < 200 &&
              (desc.includes('맛') ||
                desc.includes('음식') ||
                desc.includes('서비스') ||
                desc.includes('분위기')),
          ) || [];

      console.log(`📝 ${restaurantName} 블로그 리뷰 ${reviews.length}개 발견`);
      return reviews.slice(0, 3);
    } catch (error) {
      console.error('블로그 리뷰 검색 실패:', error);
      return [];
    }
  }
}
