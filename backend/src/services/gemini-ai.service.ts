import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  NaverPlaceCrawlerService,
  NaverPlaceData,
} from './naver-place-crawler.service';

export interface RestaurantInsight {
  name: string;
  category: string;
  address: string;
  description: string;
  representativeMenus: string[];
  telephone: string;
  lat: number;
  lng: number;
  link: string;
  distance: number;
  duration: number;
  aiRecommendation: string;
  menu?: string[];
  rating?: number;
  reviewCount?: number;
  blogReviewCount?: number;
  operatingHours?: string;
  naverDescription?: string;
}

@Injectable()
export class GeminiAiService {
  private genAI: GoogleGenerativeAI;

  constructor(private readonly naverCrawler: NaverPlaceCrawlerService) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }

  async generateKeywordsByAddress(
    address: string,
    locationInfo: { city: string; district: string; dong: string },
  ): Promise<string[]> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
      });

      const prompt = `
      주소: ${address}
      지역: ${locationInfo.city} ${locationInfo.district} ${locationInfo.dong}
      
      이 지역에서 검색할 음식점 키워드를 다음 카테고리별로 최대한 다양하게 생성해주세요:
      
     1. 음식 종류  
      - 한식, 중식, 일식, 양식, 분식, 치킨, 피자, 햄버거, 족발, 보쌈, 삼겹살, 갈비, 냉면, 국밥, 찌개, 회, 초밥, 라멘, 우동, 파스타, 스테이크, 돈까스, 덮밥, 샐러드, 쌀국수, 타코, 케밥, 뷔페, 수제버거, 쭈꾸미, 닭갈비

     2. 업체 유형  
      - 맛집, 식당, 음식점, 카페, 디저트, 베이커리, 술집, 포차, 바, 횟집, 고깃집, 분식집, 푸드코트, 브런치카페, 와인바
       
      위 예시를 참고하여 약 30개의 다양한 키워드를 생성해주세요.
      형식: - 키워드 (한 줄에 하나씩)
      `;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      const keywords = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('-') || line.startsWith('•'))
        .map((line) => line.replace(/^[-•]\s*/, '').trim())
        .filter((line) => line.length > 0 && line.length < 20)
        .slice(0, 50);

      if (keywords.length === 0) {
        // return this.getExpandedDefaultKeywords();
        return [];
      }

      return keywords;
    } catch (error) {
      console.error('❌ AI 키워드 생성 실패:', error);
      // return this.getExpandedDefaultKeywords();
      return [];
    }
  }

  private getExpandedDefaultKeywords(): string[] {
    return [
      '한식',
      '중식',
      '일식',
      '양식',
      '분식',
      '치킨',
      '피자',
      '햄버거',
      '족발',
      '보쌈',
      '삼겹살',
      '갈비',
      '냉면',
      '국밥',
      '찌개',
      '회',
      '초밥',
      '라멘',
      '우동',
      '파스타',
      '스테이크',
      '돈까스',
      '덮밥',
      '샐러드',
      '쌀국수',
      '타코',
      '케밥',
      '뷔페',
      '수제버거',
      '쭈꾸미',
      '닭갈비',
      '맛집',
      '식당',
      '음식점',
      '카페',
      '브런치',
      '디저트',
      '포차',
      '술집',
      '와인바',
    ];
  }

  async generateMainMenus(restaurant: RestaurantInsight): Promise<string[]> {
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
      const response = result.response;
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

  public extractCuisineType(category: string): string {
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

  async enrichRestaurantData(
    restaurants: RestaurantInsight[],
  ): Promise<RestaurantInsight[]> {
    try {
      console.log(`🔍 ${restaurants.length}개 음식점 동시 크롤링 시작...`);

      const restaurantNames = restaurants.map((r) => r.name);

      const naverDataResults = await this.naverCrawler.crawlMultipleRestaurants(
        restaurantNames,
        5,
      );

      console.log(
        `✅ 크롤링 완료: ${naverDataResults.length}개 음식점 데이터 수집됨`,
      );

      console.log('📊 크롤링된 데이터 상세:');
      naverDataResults.forEach((data, index) => {
        if (data) {
          console.log(`\n🍽️ ${index + 1}. ${data.name}`);
          console.log(`   평점: ${data.rating}점`);
          console.log(`   리뷰 수: ${data.reviewCount}개`);
          console.log(`   블로그 리뷰: ${data.blogReviewCount}개`);
          console.log(`   영업시간: ${data.operatingHours || '정보 없음'}`);
          console.log(
            `   네이버 설명: ${data.naverDescription ? data.naverDescription.substring(0, 100) + '...' : '정보 없음'}`,
          );
        } else {
          console.log(`\n❌ ${index + 1}. 크롤링 실패`);
        }
      });

      const naverDataMap = new Map<string, NaverPlaceData>();
      naverDataResults.forEach((data) => {
        if (data) {
          naverDataMap.set(data.name, data);
        }
      });

      const enrichedRestaurants: RestaurantInsight[] = restaurants.map(
        (restaurant) => {
          const naverData = naverDataMap.get(restaurant.name);

          if (naverData) {
            const enrichedRestaurant: RestaurantInsight = {
              ...restaurant,
              rating: naverData.rating,
              reviewCount: naverData.reviewCount,
              blogReviewCount: naverData.blogReviewCount,
              operatingHours: naverData.operatingHours,
              naverDescription: naverData.naverDescription,
            };
            return enrichedRestaurant;
          } else {
            return restaurant;
          }
        },
      );

      return enrichedRestaurants;
    } catch (error) {
      console.error('❌ 음식점 데이터 보강 실패:', error);
      return restaurants;
    }
  }

  async compareRestaurants(
    restaurants: RestaurantInsight[],
    userPreference: string,
  ): Promise<string> {
    try {
      console.log('[AI비교] 음식점 데이터 보강 시작...');

      const enrichedRestaurants = await this.enrichRestaurantData(restaurants);

      console.log('[AI비교] 데이터 보강 완료, AI 비교 분석 시작...');

      if (enrichedRestaurants.length < 2) {
        return '비교하려면 최소 2개 이상의 음식점이 필요합니다.';
      }

      const sortedRestaurants = [...enrichedRestaurants].sort((a, b) => {
        if (!a.distance && !b.distance) return 0;
        if (!a.distance) return 1;
        if (!b.distance) return -1;
        return a.distance - b.distance;
      });

      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
      });

      const best = sortedRestaurants.slice(0, 2);
      const good = sortedRestaurants.slice(2, 4);
      const alt = sortedRestaurants.slice(4, 6);

      const prompt = `
사용자 선호사항: "${userPreference}"

아래는 음식점 데이터입니다. 각 음식점의 네이버 설명(naverDescription)도 함께 제공합니다.
이 설명을 반드시 참고해서, 선호사항과 얼마나 부합하는지, 분위기/특징/장점 등을 구체적으로 비교·분석해 주세요.


**분석 기준**:
- 각 음식점의 네이버 설명(naverDescription)에서 선호사항과 일치하는 키워드, 특징, 분위기, 장점 등을 반드시 찾아서 비교
- 사용자 선호사항 "${userPreference}"와의 일치도
- 방문자 리뷰 수와 블로그 리뷰 수를 통한 인기도
      - 사용자 선호사항과 얼마나 잘 부합하는지
      - 설명에서 드러나는 특징, 분위기, 장점, 키워드 등을 비교·분석해 주세요.
      - 간단한 추천 이유에 식당에 정보를 녹여내서 어느정도 작성하도록해
      정확히 일치하는 식당이 없더라도, 가장 비슷하거나 일부 조건만 부합하는 식당이라도 반드시 추천 목록에 포함해서 출력해 주세요.
      모든 그룹에 최소 1개 이상 식당을 반드시 포함해 주세요.
      - 식당 옆에 무조건 방문자 리뷰 수, 블로그 리뷰 수는 나오게 해줘
      - 제안된 식당에 대한 설명으로 사용자의 선호사항을 간단하게 언급

${sortedRestaurants
  .map(
    (r, i) =>
      `${i + 1}. ${r.name}
    - 실제 방문자 리뷰: ${r.reviewCount || 0}개
   - 실제 블로그 리뷰: ${r.blogReviewCount || 0}개
- 네이버 설명: ${r.naverDescription || '설명 없음'}`,
  )
  .join('\n\n')}

## 🍽️ "${userPreference}" 맞춤 음식점 분석

### 🥇 최고 추천 
${best.map((r, i) => `${i + 1}. ${r.name} (방문자 리뷰 수: ${r.reviewCount || 0}개 | 블로그 리뷰 수: ${r.blogReviewCount || 0}개)\n   - [식당에 대한 네이버 정보 요약]`).join('\n\n')}

### 🥈 좋은 선택  
${good.map((r, i) => `${i + 1}. ${r.name} (방문자 리뷰 수: ${r.reviewCount || 0}개 | 블로그 리뷰 수: ${r.blogReviewCount || 0}개)\n   - [식당에 대한 네이버 정보 요약]`).join('\n\n')}

### 🥉 대안 옵션 
${alt.map((r, i) => `${i + 1}. ${r.name} (방문자 리뷰 수: ${r.reviewCount || 0}개 | 블로그 리뷰 수: ${r.blogReviewCount || 0}개)\n   - [식당에 대한 네이버 정보 요약]`).join('\n\n')}

 
      
`;

      console.log('[AI비교] 사용자 선호사항 기반 프롬프트 생성 완료');
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text().trim();

      console.log('[AI비교] 사용자 선호사항 기반 AI 비교 분석 완료');
      return text;
    } catch (error) {
      console.error('❌ 음식점 비교 AI 실패:', error);
      return 'AI 비교 결과를 생성하지 못했습니다.';
    }
  }
}
