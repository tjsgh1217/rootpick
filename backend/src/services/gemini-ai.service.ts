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
        return this.getExpandedDefaultKeywords();
        // return [];
      }

      return keywords;
    } catch (error) {
      console.error('❌ AI 키워드 생성 실패:', error);
      return this.getExpandedDefaultKeywords();
      // return [];
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
    const enrichedRestaurants: RestaurantInsight[] = [];

    for (const restaurant of restaurants) {
      try {
        console.log(`🔍 ${restaurant.name} 추가 데이터 수집 중...`);

        const naverData = await this.naverCrawler.crawlRestaurantData(
          restaurant.name,
        );

        if (naverData) {
          const enrichedRestaurant: RestaurantInsight = {
            ...restaurant,
            insight: this.generateInsightFromNaverData(naverData),
            rating: naverData.rating,
            reviewCount: naverData.reviewCount,
            blogReviewCount: naverData.blogReviewCount,
            operatingHours: naverData.operatingHours,
            naverDescription: naverData.naverDescription,
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

    return insights.join(' | ') || '일반적인 맛집';
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

      const prompt = `사용자 선호사항: "${userPreference}"

      다음 ${sortedRestaurants.length}개의 음식점을 사용자 선호사항에 맞춰 종합적으로 비교 분석해주세요.
      
      ${sortedRestaurants
        .map(
          (r, i) => `## ${i + 1}. ${r.name}
      - **카테고리**: ${r.category || '정보 없음'}
      - **주소**: ${r.address}
      - **평점**: ${r.rating ? r.rating + '점' : '정보 없음'}
      - **리뷰 수**: ${r.reviewCount || 0}개
      - **블로그 리뷰 수**: ${r.blogReviewCount || 0}개
      - **대표메뉴**: ${r.menu?.join(', ') || r.representativeMenus?.join(', ') || '메뉴 정보 수집 중'}
      - **운영시간**: ${r.operatingHours || '정보 수집 중'}
      - **거리**: ${r.distance > 0 ? (r.distance < 1000 ? r.distance + 'm' : (r.distance / 1000).toFixed(1) + 'km') : '정보 없음'}
      - **소요시간**: ${r.duration > 0 ? r.duration + '분' : '정보 없음'}
      - **네이버 설명**: ${r.naverDescription || '설명 정보 없음'}
      
      ---`,
        )
        .join('\n\n')}
      
      **중요**: 사용자 선호사항 "${userPreference}"에 맞춰서 다음 기준으로 분석해주세요:
      
      1. **네이버 설명(naverDescription)** 분석: 각 음식점의 설명에서 사용자 선호사항과 일치하는 특징 찾기
      2. **리뷰 수(reviewCount)** 분석: 인기도와 신뢰도 측면에서 평가
      3. **블로그 리뷰 수(blogReviewCount)** 분석: SNS 인기도와 트렌드 측면에서 평가
      
      ## 📊 음식점 비교 분석
      
      각 음식점을 개별적으로 분석하고, 사용자 선호사항 "${userPreference}"에 맞는 정도를 평가해주세요.
      
      ## 🏆 사용자 선호사항별 추천
      - **가장 적합한 음식점**: 
      - **대안 음식점**: 
      - **추천 이유**: 
      
      ## 💡 종합 의견
      사용자의 선호사항 "${userPreference}"에 맞춰 각 음식점의 장단점과 언제 방문하면 좋을지 구체적으로 설명해주세요.
      
      **분석 기준**:
      - 네이버 설명에서 선호사항과 일치하는 키워드나 특징
      - 리뷰 수로 본 인기도와 신뢰도
      - 블로그 리뷰 수로 본 SNS 트렌드
      - 실제 수집된 데이터를 최대한 활용하여 구체적이고 실용적인 비교 제공`;

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
