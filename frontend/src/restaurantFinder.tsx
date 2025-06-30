import React, { useState, useCallback } from 'react';
import NaverMap from './components/naverMap';
import { searchAIRestaurants, getRestaurantReview } from './api';

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
  aiRecommendation?: string; 
}

const RestaurantFinder: React.FC = () => {
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
    address: string;  
  } | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<Restaurant | null>(null);

  const handleLocationSelect = useCallback(
    async (location: { lat: number; lng: number; address: string }) => {
      console.log('🎯 RestaurantFinder에서 받은 위치:', location);

      if (!location || !location.address) {
        console.error('❌ 주소 정보가 없습니다:', location);
        setError('주소 정보가 필요합니다.');
        return;
      }

      setSelectedLocation(location);
      setLoading(true);
      setError(null);
      setRestaurants([]);
      setSelectedRestaurant(null);

      try {
        console.log('📡 AI 기반 주소 검색 시작...');

         const data = await searchAIRestaurants({
          address: location.address,
        });

        console.log('✅ API 응답 데이터:', data);

        if (!Array.isArray(data)) {
          console.error('❌ API 응답이 배열이 아닙니다:', data);
          setError('서버에서 잘못된 데이터를 받았습니다.');
          return;
        }

        setRestaurants(data);

        if (data.length === 0) {
          setError('해당 주소에서 음식점을 찾을 수 없습니다.');
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

  

   const handleGetAIReview = useCallback(
    async (restaurant: Restaurant) => {
      if (!selectedLocation) return;

      try {
        setLoading(true);

        const review = await getRestaurantReview({
          name: restaurant.name,
          location: restaurant.address,
          category: restaurant.category,
          aiRecommendation: restaurant.aiRecommendation,
        });

         alert(`🤖 AI 분석 결과\n\n${review.review}`);
      } catch (error) {
        console.error('❌ AI 리뷰 생성 실패:', error);
        setError('AI 리뷰 생성에 실패했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [selectedLocation]
  );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">
        🤖 AI 맞춤 음식점 추천 서비스
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">
            📍 지도에서 위치를 선택하세요
          </h2>
          <NaverMap
            onLocationSelect={handleLocationSelect}
            restaurants={restaurants}
          />

          {selectedLocation && (
            <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-gray-700">
              <strong>🎯 선택된 위치:</strong>
              <br />
              📍 주소: {selectedLocation.address}
              <br />
              📐 좌표: {selectedLocation.lat.toFixed(6)},{' '}
              {selectedLocation.lng.toFixed(6)}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">
            🍽️ AI 추천 음식점 ({restaurants.length}개)
          </h2>

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <div className="text-gray-500">
                🤖 AI가 해당 지역을 분석하여 맞춤 음식점을 추천하고 있습니다...
              </div>
              <div className="text-xs text-gray-400 mt-2">
                지역 특성을 고려한 최적의 추천을 준비 중입니다
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <div className="font-bold">⚠️ 오류 발생</div>
              <div>{error}</div>
              <button
                className="mt-2 bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                onClick={() => {
                  setError(null);
                  if (selectedLocation) {
                    handleLocationSelect(selectedLocation);
                  }
                }}
              >
                다시 시도
              </button>
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
                    <div className="flex flex-col items-end space-y-1">
                      <span className="text-sm font-medium text-green-600">
                        {restaurant.displayDistance}
                      </span>
                      {restaurant.aiRecommendation && (
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                          🤖 {restaurant.aiRecommendation}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mb-2">
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                      {restaurant.category}
                    </span>
                    {restaurant.cuisine && (
                      <span className="ml-2 inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                        {restaurant.cuisine}
                      </span>
                    )}
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

                  {restaurant.description && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                      <span className="font-medium text-gray-700">
                        🤖 AI 추천 이유:{' '}
                      </span>
                      <span className="text-gray-600">
                        {restaurant.description}
                      </span>
                    </div>
                  )}

                  <div className="mt-3 flex space-x-2">
                    {restaurant.link && (
                      <a
                        href={restaurant.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        네이버에서 보기 →
                      </a>
                    )}
                    <button
                      className="text-purple-600 hover:text-purple-800 text-sm underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGetAIReview(restaurant);
                      }}
                    >
                      🤖 AI 상세 분석
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading &&
            !error &&
            restaurants.length === 0 &&
            selectedLocation && (
              <div className="text-center py-8 text-gray-500">
                해당 주소에서 음식점을 찾을 수 없습니다.
                <br />
                <span className="text-sm">다른 위치를 선택해보세요.</span>
              </div>
            )}
        </div>
      </div>

       

            <div className="mb-3 flex flex-wrap gap-2">
              <span className="inline-block bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
                {selectedRestaurant.category}
              </span>
              {selectedRestaurant.aiRecommendation && (
                <span className="inline-block bg-purple-100 text-purple-800 text-sm px-3 py-1 rounded-full">
                  🤖 {selectedRestaurant.aiRecommendation}
                </span>
              )}
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

              {selectedRestaurant.description && (
                <div className="p-3 bg-gray-50 rounded">
                  <span className="text-sm font-medium text-gray-700 block mb-1">
                    🤖 AI 추천 이유:
                  </span>
                  <span className="text-sm text-gray-600">
                    {selectedRestaurant.description}
                  </span>
                </div>
              )}

              <div className="pt-3 flex space-x-2">
                {selectedRestaurant.link && (
                  <a
                    href={selectedRestaurant.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded transition-colors"
                  >
                    네이버에서 보기 →
                  </a>
                )}
                <button
                  onClick={() => handleGetAIReview(selectedRestaurant)}
                  className="inline-block bg-purple-500 hover:bg-purple-600 text-white text-sm px-4 py-2 rounded transition-colors"
                >
                  🤖 AI 상세 분석
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantFinder;
