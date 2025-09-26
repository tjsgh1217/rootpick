import { Controller, Post, Body } from '@nestjs/common';
import { RestaurantService } from '../services/restaurant.service';
import { OpenAiService } from '../services/open-ai.service';

interface LocationSearchDto {
  address: string;
  lat?: number;
  lng?: number;
}

interface CompareRestaurantsDto {
  restaurants: any[];
  userPreference: string;
}

@Controller('restaurants')
export class RestaurantsController {
  constructor(
    private readonly restaurantService: RestaurantService,
    private readonly geminiAiService: OpenAiService,
  ) {}

  @Post('search-nearby')
  async searchNearbyRestaurants(@Body() searchDto: LocationSearchDto) {
    try {
      // console.log('🎯 Controller에서 받은 정보:');
      // console.log('   주소:', searchDto.address);
      // console.log('   좌표:', searchDto.lat, searchDto.lng);

      const restaurants = await this.restaurantService.getRestaurantsByAddress(
        searchDto.address,
        searchDto.lat,
        searchDto.lng,
      );

      if (!restaurants || restaurants.length === 0) {
        // console.log('❌ 해당 주소에서 음식점을 찾을 수 없습니다.');
        return [];
      }

      // console.log(`✅ ${restaurants.length}개의 음식점 발견`);
      return restaurants;
    } catch (error) {
      // console.error('❌ 음식점 검색 실패:', error);
      throw new Error('음식점 검색에 실패했습니다.');
    }
  }

  @Post('compare')
  async compareRestaurants(@Body() body: CompareRestaurantsDto) {
    try {
      if (
        !body.restaurants ||
        !Array.isArray(body.restaurants) ||
        body.restaurants.length < 2
      ) {
        throw new Error('비교할 음식점 리스트가 2개 이상 필요합니다.');
      }

      if (!body.userPreference || !body.userPreference.trim()) {
        throw new Error('사용자 선호사항이 필요합니다.');
      }

      // console.log('🎯 사용자 선호사항:', body.userPreference);

      const result = await this.geminiAiService.compareRestaurants(
        body.restaurants,
        body.userPreference.trim(),
      );
      return { result };
    } catch (error) {
      // console.error('❌ 음식점 비교 API 실패:', error);
      return { result: 'AI 비교 결과를 생성하지 못했습니다.' };
    }
  }
}
