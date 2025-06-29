import React, { useState, useCallback } from 'react';
import NaverMap from './components/naverMap';
import { searchNearbyRestaurants } from './api';

interface Restaurant {
  id: number;
  name: string;
  lat: number;
  lng: number;
  distance: number;
  displayDistance: string;
  address: string;
  category: string;
  telephone: string;
  representativeMenus?: string[];
  reviews?: Array<{
    content: string;
    rating: number;
    date: string;
  }>;
  link?: string;
  cuisine?: string;
  rating?: number;
  priceRange?: string;
  area?: string;
  description?: string;
}

const RestaurantFinder: React.FC = () => {
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<Restaurant | null>(null);

  const handleLocationSelect = useCallback(
    async (location: { lat: number; lng: number }) => {
      console.log('🎯 RestaurantFinder에서 받은 위치:', location);

      if (
        !location ||
        typeof location.lat !== 'number' ||
        typeof location.lng !== 'number'
      ) {
        console.error('❌ 잘못된 좌표 데이터:', location);
        setError('잘못된 좌표 데이터입니다.');
        return;
      }

      setSelectedLocation(location);
      setLoading(true);
      setError(null);
      setRestaurants([]);
      setSelectedRestaurant(null);

      try {
        console.log('📡 API 호출 시작...');

        const data = await searchNearbyRestaurants({
          lat: location.lat,
          lng: location.lng,
        });

        console.log('✅ API 응답 데이터:', data);

        if (!Array.isArray(data)) {
          console.error('❌ API 응답이 배열이 아닙니다:', data);
          setError('서버에서 잘못된 데이터를 받았습니다.');
          return;
        }

        setRestaurants(data);

        if (data.length === 0) {
          setError('해당 위치에서 음식점을 찾을 수 없습니다.');
        } else {
          console.log(`✅ ${data.length}개의 음식점 데이터 설정 완료`);
        }
      } catch (error: any) {
        console.error('❌ 음식점 검색 실패:', error);

        let errorMessage = '음식점 검색에 실패했습니다.';

        if (error.response) {
          errorMessage = `서버 오류 (${error.response.status}): ${
            error.response.data?.message || '알 수 없는 오류'
          }`;
        } else if (error.request) {
          errorMessage =
            '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
        }

        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleRestaurantClick = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
  };

  const handleCloseCard = () => {
    setSelectedRestaurant(null);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">
        실제 음식점 검색 서비스
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

          {selectedLocation && (
            <div className="mt-2 p-2 bg-gray-100 rounded text-sm text-gray-700">
              <strong>선택된 좌표:</strong>
              <br />
              위도: {selectedLocation.lat.toFixed(6)}
              <br />
              경도: {selectedLocation.lng.toFixed(6)}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">
            주변 음식점 ({restaurants.length}개)
          </h2>

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <div className="text-gray-500">
                실제 음식점을 검색 중입니다...
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <div className="font-bold">오류 발생</div>
              <div>{error}</div>
            </div>
          )}

          {restaurants.length > 0 && !loading && (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {restaurants.map((restaurant) => (
                <div
                  key={restaurant.id}
                  className="bg-white p-4 rounded-lg shadow-md border hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleRestaurantClick(restaurant)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg text-blue-800">
                      {restaurant.name}
                    </h3>
                    <span className="text-sm font-medium text-green-600">
                      {restaurant.displayDistance}
                    </span>
                  </div>

                  <div className="mb-2">
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                      {restaurant.category}
                    </span>
                  </div>

                  <p className="text-gray-600 text-sm mb-2">
                    📍 {restaurant.address}
                  </p>

                  {restaurant.telephone &&
                    restaurant.telephone !== '정보 없음' && (
                      <p className="text-gray-600 text-sm mb-2">
                        📞 {restaurant.telephone}
                      </p>
                    )}

                  {restaurant.representativeMenus &&
                    restaurant.representativeMenus.length > 0 &&
                    restaurant.representativeMenus.some(
                      (menu) => menu && menu.trim() !== ''
                    ) && (
                      <div className="mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          대표메뉴:{' '}
                        </span>
                        <span className="text-sm text-gray-600">
                          {restaurant.representativeMenus
                            .filter((menu) => menu && menu.trim() !== '')
                            .join(', ')}
                        </span>
                      </div>
                    )}

                  {restaurant.reviews && restaurant.reviews.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        리뷰
                      </h4>
                      {restaurant.reviews
                        .slice(0, 2)
                        .map((review, reviewIndex) => (
                          <div
                            key={reviewIndex}
                            className="mb-2 p-2 bg-gray-50 rounded text-sm"
                          >
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-yellow-500">
                                {'★'.repeat(Math.floor(review.rating))}
                              </span>
                              <span className="text-xs text-gray-500">
                                {review.date}
                              </span>
                            </div>
                            <p className="text-gray-700">{review.content}</p>
                          </div>
                        ))}
                    </div>
                  )}

                  {restaurant.link && restaurant.link !== '' && (
                    <div className="mt-2">
                      <a
                        href={restaurant.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        네이버에서 보기 →
                      </a>
                    </div>
                  )}

                  {restaurant.priceRange && (
                    <div className="mt-2">
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        가격대: {restaurant.priceRange}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!loading &&
            !error &&
            restaurants.length === 0 &&
            selectedLocation && (
              <div className="text-center py-8 text-gray-500">
                해당 위치에서 음식점을 찾을 수 없습니다.
                <br />
                <span className="text-sm">다른 위치를 선택해보세요.</span>
              </div>
            )}
        </div>
      </div>

      {selectedRestaurant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                {selectedRestaurant.name}
              </h3>
              <button
                onClick={handleCloseCard}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none"
              >
                ×
              </button>
            </div>

            <div className="mb-3">
              <span className="inline-block bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
                {selectedRestaurant.category}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-start space-x-2">
                <span className="text-gray-500">📍</span>
                <span className="text-sm text-gray-700">
                  {selectedRestaurant.address}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-gray-500">🚶</span>
                <span className="text-sm font-medium text-green-600">
                  {selectedRestaurant.displayDistance}
                </span>
              </div>

              {selectedRestaurant.telephone &&
                selectedRestaurant.telephone !== '정보 없음' && (
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500">📞</span>
                    <span className="text-sm text-gray-700">
                      {selectedRestaurant.telephone}
                    </span>
                  </div>
                )}

              {selectedRestaurant.representativeMenus &&
                selectedRestaurant.representativeMenus.length > 0 &&
                selectedRestaurant.representativeMenus.some(
                  (menu) => menu && menu.trim() !== ''
                ) && (
                  <div>
                    <span className="text-sm font-medium text-gray-700 block mb-1">
                      대표메뉴:
                    </span>
                    <span className="text-sm text-gray-600">
                      {selectedRestaurant.representativeMenus
                        .filter((menu) => menu && menu.trim() !== '')
                        .join(', ')}
                    </span>
                  </div>
                )}

              {selectedRestaurant.link && selectedRestaurant.link !== '' && (
                <div className="pt-3">
                  <a
                    href={selectedRestaurant.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded transition-colors"
                  >
                    네이버에서 보기 →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantFinder;
