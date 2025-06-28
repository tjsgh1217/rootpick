import React, { useState } from 'react';
import NaverMap from './components/naverMap';
import axios from 'axios';

interface Restaurant {
  name: string;
  lat: number;
  lng: number;
  distance: number;
  description?: string;
}

const RestaurantFinder: React.FC = () => {
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);

  const handleLocationSelect = async (location: {
    lat: number;
    lng: number;
  }) => {
    setSelectedLocation(location);
    setLoading(true);

    try {
      const response = await axios.post('/api/restaurants/search-nearby', {
        lat: location.lat,
        lng: location.lng,
      });

      setRestaurants(response.data);
    } catch (error) {
      console.error('음식점 검색 실패:', error);
      alert('음식점 검색에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">
        AI 음식점 추천 서비스
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">
            지도에서 위치를 선택하세요
          </h2>
          <NaverMap
            onLocationSelect={handleLocationSelect}
            restaurants={restaurants}
          />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">
            추천 음식점 ({restaurants.length}개)
          </h2>

          {loading && (
            <div className="text-center py-8">
              <div className="text-gray-500">음식점을 검색 중입니다...</div>
            </div>
          )}

          {restaurants.length > 0 && (
            <div className="space-y-4">
              {restaurants.map((restaurant, index) => (
                <div
                  key={index}
                  className="bg-white p-4 rounded-lg shadow-md border"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg">{restaurant.name}</h3>
                    <span className="text-sm text-gray-500">
                      {restaurant.distance}m
                    </span>
                  </div>
                  {restaurant.description && (
                    <p className="text-gray-600 text-sm">
                      {restaurant.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loading && restaurants.length === 0 && selectedLocation && (
            <div className="text-center py-8 text-gray-500">
              해당 위치에서 음식점을 찾을 수 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RestaurantFinder;
