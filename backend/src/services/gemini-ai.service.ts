import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
}

@Injectable()
export class GeminiAiService {
  private genAI: GoogleGenerativeAI;

  constructor() {
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
        .filter((line) => /^[-•\d.]/.test(line))
        .slice(0, 50);

      // if (keywords.length === 0) {
      //   return this.getExpandedDefaultKeywords(locationInfo);
      // }

      return keywords;
    } catch (error) {
      console.error('❌ AI 키워드 생성 실패:', error);
      // return this.getExpandedDefaultKeywords(locationInfo);
      return [];
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

  async compareRestaurants(restaurants: RestaurantInsight[]): Promise<string> {
    try {
      console.log(
        '[AI비교] compareRestaurants 호출, 음식점 수:',
        restaurants.length,
      );
      console.log(
        '[AI비교] AI에게 전달되는 음식점 정보:',
        JSON.stringify(restaurants, null, 2),
      );

      if (restaurants.length < 2) {
        return '비교하려면 최소 2개 이상의 음식점이 필요합니다.';
      }

      const sortedRestaurants = [...restaurants].sort((a, b) => {
        if (!a.distance && !b.distance) return 0;
        if (!a.distance) return 1;
        if (!b.distance) return -1;
        return a.distance - b.distance;
      });

      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
      });

      const prompt = `다음 ${sortedRestaurants.length}개의 음식점을 거리순(가까운 곳부터)으로 비교 분석해주세요.
  
  음식점 정보:
  ${sortedRestaurants
    .map(
      (r, i) =>
        `${i + 1}. **${r.name}**
     - 카테고리: ${r.category || '정보 없음'}
     - 음식종류: ${this.extractCuisineType(r.category || '')}
     - 주소: ${r.address}
     - 대표메뉴: ${r.representativeMenus?.join(', ') || r.menu?.join(', ') || '메뉴 정보 수집 중'}
     - 특징: ${r.description || r.insight || '일반적인 맛집'}
     - 거리: ${r.distance > 0 ? (r.distance < 1000 ? r.distance + 'm' : (r.distance / 1000).toFixed(1) + 'km') : '정보 없음'}
     - 소요시간: ${r.duration > 0 ? r.duration + '분' : '정보 없음'}`,
    )
    .join('\n\n')}
  
  위 음식점들을 다음 기준으로 **실용적이고 도움이 되는** 비교표를 만들어주세요:
  
  | 음식점 | 음식종류 | 접근성 | 예상가격대 | 추천상황 | 특징 |
  |--------|----------|--------|------------|----------|------|
  
  각 항목 설명:
  - **접근성**: 거리와 소요시간 기준 (가까움/보통/멀음)
  - **예상가격대**: 음식 카테고리 기준 일반적 가격대 (저렴/보통/비싼)
  - **추천상황**: 언제 방문하면 좋을지 (혼밥/데이트/회식/가족식사 등)
  - **특징**: 각 음식점의 독특한 점이나 장점
  
  **중요**: 제공된 정보가 부족하더라도 카테고리와 위치를 바탕으로 합리적인 추정을 해주세요. "정보 없음"보다는 일반적인 추정값을 제공해주세요.`;

      console.log('[AI비교] 개선된 프롬프트 생성 완료');
      const result = await model.generateContent(prompt);
      console.log('[AI비교] Gemini generateContent 호출 완료');
      const response = result.response;
      const text = response.text().trim();
      console.log('[AI비교] Gemini 응답 텍스트:', text.slice(0, 200));
      return text;
    } catch (error) {
      console.error('❌ 음식점 비교 AI 실패:', error);
      return 'AI 비교 결과를 생성하지 못했습니다.';
    }
  }
}
