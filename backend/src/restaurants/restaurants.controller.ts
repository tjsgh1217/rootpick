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
        console.log('❌ AI에서 음식점 데이터를 받지 못했습니다.');
        return [];
      }

       const restaurantsWithAccurateLocation = restaurants
        .map((restaurant, index) => {
           const distanceInMeters =
            restaurant.distanceUnit === 'km'
              ? restaurant.estimatedDistance * 1000
              : restaurant.estimatedDistance;

           const directions = [
            { angle: 0, name: '북쪽' },
            { angle: 45, name: '북동쪽' },
            { angle: 90, name: '동쪽' },
            { angle: 135, name: '남동쪽' },
            { angle: 180, name: '남쪽' },
            { angle: 225, name: '남서쪽' },
            { angle: 270, name: '서쪽' },
            { angle: 315, name: '북서쪽' },
          ];

          const direction = directions[index % directions.length];

           const { newLat, newLng } = this.calculateNewCoordinates(
            searchDto.lat,
            searchDto.lng,
            distanceInMeters,
            direction.angle,
          );

           const actualDistance = this.calculateDistance(
            searchDto.lat,
            searchDto.lng,
            newLat,
            newLng,
          );

           const displayDistance =
            actualDistance >= 1000
              ? `${(actualDistance / 1000).toFixed(1)}km`
              : `${Math.round(actualDistance)}m`;

          console.log(
            `${restaurant.name}: 목표거리 ${restaurant.estimatedDistance}${restaurant.distanceUnit}, 실제거리 ${displayDistance}, 방향 ${direction.name}`,
          );

          return {
            ...restaurant,
            lat: newLat,
            lng: newLng,
            distance: Math.round(actualDistance),
            displayDistance: displayDistance,
            direction: direction.name,
            id: index + 1,
          };
        })
        .sort((a, b) => a.distance - b.distance);

      console.log('✅ 최종 음식점 데이터:', restaurantsWithAccurateLocation);
      return restaurantsWithAccurateLocation;
    } catch (error) {
      console.error('❌ 음식점 검색 실패:', error);
      throw new Error('음식점 검색에 실패했습니다.');
    }
  }

   private calculateNewCoordinates(
    lat: number,
    lng: number,
    distanceM: number,
    angleDeg: number,
  ): { newLat: number; newLng: number } {
    const R = 6371000;  
    const angleRad = (angleDeg * Math.PI) / 180;  

     const deltaLat = (distanceM * Math.cos(angleRad)) / R;
    const newLat = lat + (deltaLat * 180) / Math.PI;

     const deltaLng =
      (distanceM * Math.sin(angleRad)) / (R * Math.cos((lat * Math.PI) / 180));
    const newLng = lng + (deltaLng * 180) / Math.PI;

    console.log(`좌표 계산: 거리 ${distanceM}m, 각도 ${angleDeg}도`);
    console.log(`  기준점: ${lat}, ${lng}`);
    console.log(`  새 좌표: ${newLat}, ${newLng}`);

    return { newLat, newLng };
  }

   private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371000; 
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
