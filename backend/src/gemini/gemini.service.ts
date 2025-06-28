import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }

  async getRestaurantRecommendations(
    lat: number,
    lng: number,
    address?: string,
  ) {
    try {
      console.log('🎯 Gemini Service에서 받은 정확한 좌표:');
      console.log('   위도 (정밀):', lat);
      console.log('   경도 (정밀):', lng);
      console.log('   위도 문자열:', lat.toString());
      console.log('   경도 문자열:', lng.toString());

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        console.error('❌ 잘못된 좌표 타입:', { lat, lng });
        return [];
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        console.error('❌ 좌표 범위 오류:', { lat, lng });
        return [];
      }

      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
      });

      // 지역 제한 없이 유연한 거리 설정
      const prompt = `
       정확한 위치 좌표: 위도 ${lat}, 경도 ${lng}
      
      이 정밀한 좌표를 기준으로 주변 음식점을 추천해주세요.
      좌표의 정밀도를 고려하여 해당 지점에서 실제로 접근 가능한 음식점들을 추천해주세요.
        
        JSON 형태로만 응답:
        {
          "restaurants": [
            {
              "name": "음식점 이름 (해당 지역 특성 반영)",
              "cuisine": "음식 종류",
              "description": "특징 설명 (30자 이내)",
              "estimatedDistance": 거리_숫자,
              "distanceUnit": "m|km",
              "priceRange": "저렴|보통|비싸",
              "rating": 평점_숫자 (3.0~4.8 범위),
              "specialties": ["대표메뉴1", "대표메뉴2"],
              "area": "해당 지역명"
            }
          ]
        }
        
        거리 설정 가이드라인:
        - 도심지역: 50m~2km 범위에서 다양하게 (예: 150m, 400m, 800m, 1.2km, 1.8km)
        - 교외지역: 200m~5km 범위에서 다양하게 (예: 300m, 1km, 2.5km, 4km, 5km)
        - 거리가 1km 이상이면 distanceUnit을 "km"로, 1km 미만이면 "m"으로 설정
        
        주의사항:
        - 좌표에 해당하는 실제 지역의 특성을 파악하여 음식점 이름에 반영
        - 해당 지역에 실제로 있을 법한 음식점만 추천
        - 다양한 음식 종류로 구성 (한식, 중식, 일식, 양식, 치킨, 분식, 카페 등)
        - 거리순으로 정렬해서 응답
        - 지역명을 area 필드에 포함 (예: "강남구", "부산 해운대구", "제주시" 등)
      `;

      console.log('📤 Gemini에게 전송하는 프롬프트:');
      console.log(prompt);

      const startTime = Date.now();
      const result = await model.generateContent(prompt);
      const endTime = Date.now();

      const response = await result.response;
      const text = response.text();

      console.log('🤖 Gemini AI 원본 응답:');
      console.log(text);

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedData = JSON.parse(jsonMatch[0]);
          console.log('✅ JSON 파싱 성공:');
          console.log(parsedData);

          if (parsedData.restaurants && Array.isArray(parsedData.restaurants)) {
            console.log(
              `✅ ${parsedData.restaurants.length}개 음식점 데이터 반환`,
            );

            const sortedRestaurants = parsedData.restaurants.sort((a, b) => {
              const distanceA =
                a.distanceUnit === 'km'
                  ? a.estimatedDistance * 1000
                  : a.estimatedDistance;
              const distanceB =
                b.distanceUnit === 'km'
                  ? b.estimatedDistance * 1000
                  : b.estimatedDistance;
              return distanceA - distanceB;
            });

            sortedRestaurants.forEach((restaurant, index) => {
              console.log(`🍽️ ${index + 1}. ${restaurant.name}:`);
              console.log(
                `   AI 설정 거리: ${restaurant.estimatedDistance}${restaurant.distanceUnit}`,
              );
              console.log(`   지역: ${restaurant.area || '미지정'}`);
              console.log(`   종류: ${restaurant.cuisine}`);
              console.log(`   가격: ${restaurant.priceRange}`);
              console.log(`   평점: ${restaurant.rating}`);
            });

            return sortedRestaurants;
          } else {
            console.error('❌ restaurants 배열이 없음');
            return [];
          }
        } else {
          console.error('❌ JSON 형태를 찾을 수 없음');
          return [];
        }
      } catch (parseError) {
        console.error('❌ JSON 파싱 실패:', parseError);
        console.error('❌ 파싱 시도한 텍스트:', text);
        return [];
      }
    } catch (error) {
      console.error('❌ Gemini API 호출 실패:', error);
      console.error('❌ 에러 상세:', error.stack);
      return [];
    }
  }

  async getDetailedReview(restaurantName: string, location: string) {
    try {
      console.log('📝 리뷰 생성 요청:');
      console.log('   음식점:', restaurantName);
      console.log('   위치:', location);

      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
      });

      const prompt = `
        음식점: ${restaurantName}
        위치: ${location}
        
        이 음식점에 대한 상세한 리뷰를 작성해주세요. 다음 내용을 포함해주세요:
        1. 음식의 맛과 품질
        2. 서비스와 직원 친절도
        3. 매장 분위기와 인테리어
        4. 가격 대비 만족도
        5. 추천하는 이유
        
        150자 이내로 자연스럽고 현실적인 리뷰를 작성해주세요.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const reviewText = response.text();

      console.log('✅ 리뷰 생성 완료:', reviewText);
      return reviewText;
    } catch (error) {
      console.error('❌ 상세 리뷰 생성 실패:', error);
      return '리뷰 생성에 실패했습니다.';
    }
  }
}
