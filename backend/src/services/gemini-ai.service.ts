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
  insight?: string;
  rating?: number;
  reviewCount?: number;
  priceRange?: string;
  operatingHours?: string;
  facilities?: string[];
  recentReviews?: { rating: number; content: string }[];
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
        return this.getExpandedDefaultKeywords(locationInfo);
      }

      return keywords;
    } catch (error) {
      console.error('❌ AI 키워드 생성 실패:', error);
      return this.getExpandedDefaultKeywords(locationInfo);
    }
  }

  private getExpandedDefaultKeywords(locationInfo: {
    city: string;
    district: string;
    dong: string;
  }): string[] {
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
    const enrichedRestaurants: RestaurantInsight[] = [];

    for (const restaurant of restaurants) {
      try {
        console.log(`🔍 ${restaurant.name} 추가 데이터 수집 중...`);

        const naverData = await this.naverCrawler.crawlRestaurantData(
          restaurant.name,
          restaurant.address,
        );

        if (naverData) {
          const enrichedRestaurant: RestaurantInsight = {
            ...restaurant,
            menu:
              naverData.menus.length > 0
                ? naverData.menus.map((m) => m.name)
                : restaurant.menu,
            insight: this.generateInsightFromNaverData(naverData),
            rating: naverData.rating,
            reviewCount: naverData.reviewCount,
            priceRange: naverData.priceRange,
            operatingHours: naverData.operatingHours,
            facilities: naverData.facilities,
            recentReviews: naverData.reviews,
          };

          enrichedRestaurants.push(enrichedRestaurant);
        } else {
          enrichedRestaurants.push(restaurant);
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`❌ ${restaurant.name} 데이터 보강 실패:`, error);
        enrichedRestaurants.push(restaurant);
      }
    }

    return enrichedRestaurants;
  }

  private generateInsightFromNaverData(naverData: NaverPlaceData): string {
    const insights: string[] = [];

    if (naverData.rating >= 4.5) {
      insights.push('⭐ 높은 평점의 인기 맛집');
    } else if (naverData.rating >= 4.0) {
      insights.push('⭐ 좋은 평점의 맛집');
    }

    if (naverData.reviewCount > 100) {
      insights.push('👥 많은 리뷰를 보유한 검증된 맛집');
    } else if (naverData.reviewCount > 50) {
      insights.push('👥 적당한 리뷰를 보유한 맛집');
    }

    if (naverData.priceRange) {
      insights.push(`💰 ${naverData.priceRange}`);
    }

    if (naverData.facilities.length > 0) {
      insights.push(
        `🏪 ${naverData.facilities.slice(0, 2).join(', ')} 이용 가능`,
      );
    }

    if (naverData.menus.length > 0) {
      insights.push(
        `🍽️ ${naverData.menus
          .slice(0, 2)
          .map((m) => m.name)
          .join(', ')} 등`,
      );
    }

    return insights.join(' | ') || '일반적인 맛집';
  }

  async compareRestaurants(restaurants: RestaurantInsight[]): Promise<string> {
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

      const prompt = `다음 ${sortedRestaurants.length}개의 음식점을 종합적으로 비교 분석해주세요.

음식점 정보:
${sortedRestaurants
  .map(
    (r, i) => `${i + 1}. **${r.name}**
   - 카테고리: ${r.category || '정보 없음'}
   - 음식종류: ${this.extractCuisineType(r.category || '')}
   - 주소: ${r.address}
   - 평점: ${r.rating ? r.rating + '점' : '정보 없음'} (리뷰 ${r.reviewCount || 0}개)
   - 대표메뉴: ${r.menu?.join(', ') || r.representativeMenus?.join(', ') || '메뉴 정보 수집 중'}
   - 가격대: ${r.priceRange || '정보 수집 중'}
   - 운영시간: ${r.operatingHours || '정보 수집 중'}
   - 편의시설: ${r.facilities?.join(', ') || '정보 없음'}
   - 거리: ${r.distance > 0 ? (r.distance < 1000 ? r.distance + 'm' : (r.distance / 1000).toFixed(1) + 'km') : '정보 없음'}
   - 소요시간: ${r.duration > 0 ? r.duration + '분' : '정보 없음'}
   - 최근 리뷰 키워드: ${r.recentReviews?.map((rev) => rev.content.slice(0, 50)).join(' | ') || '리뷰 정보 없음'}`,
  )
  .join('\n\n')}

위 정보를 바탕으로 다음과 같이 **실용적이고 상세한** 비교표를 만들어주세요:

## 📊 음식점 비교 분석

| 순위 | 음식점 | 평점/리뷰 | 가격대 | 접근성 | 추천상황 | 주요특징 |
|------|--------|-----------|--------|--------|----------|----------|

## 🎯 상황별 추천
- **가성비 최고**: 
- **평점 최고**: 
- **접근성 최고**: 
- **데이트 추천**: 
- **가족식사 추천**: 

## 💡 종합 의견
각 음식점의 장단점과 언제 방문하면 좋을지 구체적으로 설명해주세요.

**중요**: 실제 수집된 데이터(평점, 리뷰, 메뉴, 가격대)를 최대한 활용하여 구체적이고 실용적인 비교를 제공해주세요.`;

      console.log('[AI비교] 보강된 데이터로 프롬프트 생성 완료');
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text().trim();

      console.log('[AI비교] 향상된 AI 비교 분석 완료');
      return text;
    } catch (error) {
      console.error('❌ 음식점 비교 AI 실패:', error);
      return 'AI 비교 결과를 생성하지 못했습니다.';
    }
  }
}
