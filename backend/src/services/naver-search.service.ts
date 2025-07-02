import { Injectable } from '@nestjs/common';
import axios from 'axios';

interface NaverSearchResponse {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: Array<{
    title: string;
    link: string;
    category: string;
    description: string;
    telephone: string;
    address: string;
    roadAddress: string;
    mapx: string;
    mapy: string;
  }>;
}

export interface RestaurantSearchResult {
  name: string;
  address: string;
  telephone: string;
  category: string;
  lat: number;
  lng: number;
  link: string;
  description: string;
  aiRecommendation: string;
}

@Injectable()
export class NaverSearchService {
  async searchRestaurantsByAddress(
    address: string,
    keywords: string[],
  ): Promise<RestaurantSearchResult[]> {
    try {
      let allRestaurants: RestaurantSearchResult[] = [];

      for (const keyword of keywords) {
        try {
          console.log(`🔍 "${address} ${keyword}" 검색 중...`);

          const response = await axios.get<NaverSearchResponse>(
            'https://openapi.naver.com/v1/search/local.json',
            {
              params: {
                query: `${address} ${keyword}`,
                display: 10,
                start: 1,
                sort: 'comment',
              },
              headers: {
                'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
                'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
              },
              responseType: 'json',
              responseEncoding: 'utf8',
              timeout: 10000,
            },
          );

          if (response.data.items && response.data.items.length > 0) {
            const restaurantsData: RestaurantSearchResult[] =
              response.data.items
                .filter(
                  (item) => item.category && item.category.includes('음식점'),
                )
                .map((item) => ({
                  name: this.decodeHtmlEntities(
                    item.title.replace(/<[^>]*>/g, ''),
                  ),
                  address: this.decodeHtmlEntities(
                    item.roadAddress || item.address,
                  ),
                  telephone: item.telephone || '',
                  category: item.category,
                  lat: parseFloat(item.mapy) / 10000000,
                  lng: parseFloat(item.mapx) / 10000000,
                  link: item.link,
                  description: item.description || '',
                  aiRecommendation: keyword,
                }));

            allRestaurants.push(...restaurantsData);
          }

          await new Promise((resolve) => setTimeout(resolve, 800));
        } catch (queryError) {
          console.error(`❌ "${keyword}" 검색 실패:`, queryError.message);
          continue;
        }
      }

      const uniqueRestaurants = allRestaurants.filter(
        (restaurant, index, self) =>
          index ===
          self.findIndex(
            (r) =>
              r.name === restaurant.name && r.address === restaurant.address,
          ),
      );

      return uniqueRestaurants.slice(0, 10);
    } catch (error) {
      console.error('❌ 주소 기반 검색 실패:', error);
      throw new Error('주소 기반 음식점 검색에 실패했습니다.');
    }
  }

  async searchPlaces(query: string) {
    try {
      console.log(`🔍 네이버 지역검색 API로 "${query}" 검색 중...`);

      const response = await axios.get<NaverSearchResponse>(
        'https://openapi.naver.com/v1/search/local.json',
        {
          params: {
            query: query,
            display: 10,
            start: 1,
            sort: 'random',
          },
          headers: {
            'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
            'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
          },
          responseType: 'json',
          responseEncoding: 'utf8',
          timeout: 10000,
        },
      );

      const places = response.data.items.map((item) => ({
        title: this.decodeHtmlEntities(item.title.replace(/<[^>]*>/g, '')),
        roadAddress: this.decodeHtmlEntities(item.roadAddress || ''),
        address: this.decodeHtmlEntities(item.address || ''),
        mapx: item.mapx,
        mapy: item.mapy,
        category: item.category,
      }));

      return places;
    } catch (error) {
      console.error('❌ 장소 검색 실패:', error);
      return [];
    }
  }

  private decodeHtmlEntities(text: string): string {
    const entities = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#x27;': "'",
      '&#x2F;': '/',
      '&#39;': "'",
      '&nbsp;': ' ',
      '&apos;': "'",
    };

    return text.replace(/&[#\w]+;/g, (entity) => {
      return entities[entity] || entity;
    });
  }
}
