import { Injectable } from '@nestjs/common';
import axios from 'axios';

interface DirectionResponse {
  route: {
    traoptimal: Array<{
      summary: {
        distance: number;
        duration: number;
      };
    }>;
  };
}

export interface DistanceResult {
  distance: number;
  duration: number;
}

@Injectable()
export class NaverDirectionService {
  async calculateRealDistance(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
  ): Promise<DistanceResult> {
    try {
      // console.log(
      //   `🚗 Direction API 호출: ${startLat},${startLng} → ${endLat},${endLng}`,
      // );

      const response = await axios.get<DirectionResponse>(
        'https://maps.apigw.ntruss.com/map-direction/v1/driving',
        {
          params: {
            start: `${startLng},${startLat}`,
            goal: `${endLng},${endLat}`,
            option: 'traoptimal',
          },
          headers: {
            'X-NCP-APIGW-API-KEY-ID': process.env.NCP_ACCESS_KEY_ID,
            'X-NCP-APIGW-API-KEY': process.env.NCP_SECRET_KEY,
          },
          timeout: 5000,
        },
      );

      if (response.data.route?.traoptimal?.[0]) {
        const route = response.data.route.traoptimal[0];
        const distance = route.summary.distance;
        const duration = Math.round(route.summary.duration / 1000 / 60);

        // console.log(`✅ Direction API 성공: ${distance}m, ${duration}분`);
        return { distance, duration };
      }

      // console.log('❌ Direction API 응답 없음');
      return { distance: 0, duration: 0 };
    } catch (error) {
      // console.error('❌ Direction API 호출 실패:', error.message);
      return { distance: 0, duration: 0 };
    }
  }

  async calculateDistancesForRestaurants(
    userLat: number,
    userLng: number,
    restaurants: Array<{ lat: number; lng: number; name: string }>,
  ): Promise<DistanceResult[]> {
    const results: DistanceResult[] = [];

    for (const restaurant of restaurants) {
      // console.log(`🚗 Direction API 호출: ${restaurant.name}`);
      const result = await this.calculateRealDistance(
        userLat,
        userLng,
        restaurant.lat,
        restaurant.lng,
      );
      results.push(result);

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  }
}
