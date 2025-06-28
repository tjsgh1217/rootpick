import axios from 'axios';

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    console.error('API 요청 에러:', error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API 응답 에러:', error.response?.status, error.message);
    return Promise.reject(error);
  }
);

export const searchNearbyRestaurants = async (locationData) => {
  try {
    const response = await apiClient.post('/restaurants/search-nearby', {
      lat: locationData.lat,
      lng: locationData.lng,
      address:
        locationData.address ||
        `위도 ${locationData.lat.toFixed(4)}, 경도 ${locationData.lng.toFixed(
          4
        )}`,
    });

    return response.data;
  } catch (error) {
    console.error('음식점 검색 실패:', error);
    throw new Error(
      error.response?.data?.message ||
        '음식점 검색에 실패했습니다. 다시 시도해주세요.'
    );
  }
};

export const getRestaurantReview = async (reviewData) => {
  try {
    const response = await apiClient.post('/restaurants/get-review', {
      name: reviewData.name,
      location: reviewData.location,
    });

    return response.data.review;
  } catch (error) {
    console.error('리뷰 조회 실패:', error);
    throw new Error(
      error.response?.data?.message || '리뷰를 불러오는데 실패했습니다.'
    );
  }
};

export const addToFavorites = async (restaurant) => {
  try {
    const response = await apiClient.post('/restaurants/favorites', restaurant);
    return response.data;
  } catch (error) {
    console.error('즐겨찾기 추가 실패:', error);
    throw new Error('즐겨찾기 추가에 실패했습니다.');
  }
};

export const getFavorites = async () => {
  try {
    const response = await apiClient.get('/restaurants/favorites');
    return response.data;
  } catch (error) {
    console.error('즐겨찾기 조회 실패:', error);
    throw new Error('즐겨찾기 목록을 불러오는데 실패했습니다.');
  }
};

export { apiClient };
