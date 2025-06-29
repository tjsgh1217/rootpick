import { Controller, Post, Body } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.service';

interface LocationSearchDto {
  lat: number;
  lng: number;
  address?: string;
}

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly geminiService: GeminiService) {}

  @Post('search-nearby')
  async searchNearbyRestaurants(@Body() searchDto: LocationSearchDto) {
    try {
      console.log('🎯 Controller에서 받은 정확한 좌표:');
      console.log('   위도 (원본):', searchDto.lat);
      console.log('   경도 (원본):', searchDto.lng);
      console.log('   주소:', searchDto.address);

      const latPrecision = (searchDto.lat.toString().split('.')[1] || '')
        .length;
      const lngPrecision = (searchDto.lng.toString().split('.')[1] || '')
        .length;

      console.log(
        `   좌표 정밀도: 위도 ${latPrecision}자리, 경도 ${lngPrecision}자리`,
      );

      const restaurants = await this.geminiService.getRestaurantRecommendations(
        searchDto.lat,
        searchDto.lng,
        searchDto.address,
      );

      if (!restaurants || restaurants.length === 0) {
        console.log('❌ 실제 음식점 데이터를 받지 못했습니다.');
        return [];
      }

      const restaurantsWithDetails = restaurants.map((restaurant, index) => {
        console.log(
          `${restaurant.name}: 실제거리 ${restaurant.displayDistance}, 주소 ${restaurant.address}`,
        );

        return {
          ...restaurant,
        };
      });

      console.log('✅ 최종 실제 음식점 데이터:', restaurantsWithDetails);
      return restaurantsWithDetails;
    } catch (error) {
      console.error('❌ 음식점 검색 실패:', error);
      throw new Error('음식점 검색에 실패했습니다.');
    }
  }

  @Post('get-review')
  async getRestaurantReview(
    @Body() reviewDto: { name: string; location: string },
  ) {
    try {
      const review = await this.geminiService.getDetailedReview(
        reviewDto.name,
        reviewDto.location,
      );
      return { review };
    } catch (error) {
      console.error('❌ 리뷰 생성 실패:', error);
      throw new Error('리뷰 생성에 실패했습니다.');
    }
  }
}
