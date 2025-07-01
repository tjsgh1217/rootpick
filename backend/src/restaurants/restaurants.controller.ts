import { Controller, Post, Body } from '@nestjs/common';
import { GeminiService } from '../gemini/gemini.service';

interface LocationSearchDto {
  address: string;
  lat?: number;
  lng?: number;
}

@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly geminiService: GeminiService) {}

  @Post('search-nearby')
  async searchNearbyRestaurants(@Body() searchDto: LocationSearchDto) {
    try {
      console.log('🎯 Controller에서 받은 정보:');
      console.log('   주소:', searchDto.address);
      console.log('   좌표:', searchDto.lat, searchDto.lng);

      const restaurants = await this.geminiService.getRestaurantsByAddress(
        searchDto.address,
        searchDto.lat,
        searchDto.lng,
      );

      if (!restaurants || restaurants.length === 0) {
        console.log('❌ 해당 주소에서 음식점을 찾을 수 없습니다.');
        return [];
      }

      console.log(`✅ ${restaurants.length}개의 음식점 발견`);
      return restaurants;
    } catch (error) {
      console.error('❌ 음식점 검색 실패:', error);
      throw new Error('음식점 검색에 실패했습니다.');
    }
  }
}
