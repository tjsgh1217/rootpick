import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    // console.log('🌐 API 요청:', {
    //   url: `${config.baseURL}${config.url}`,
    //   method: config.method,
    //   data: config.data,
    // });
    return config;
  },
  (error) => {
    // console.error('❌ API 요청 에러:', error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    // console.log('✅ API 응답 성공:', {
    //   status: response.status,
    //   url: response.config.url,
    //   dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
    // });
    return response;
  },
  (error) => {
    // console.error('❌ API 응답 에러:', {
    //   status: error.response?.status,
    //   message: error.message,
    //   url: error.config?.url,
    //   baseURL: error.config?.baseURL,
    // });
    return Promise.reject(error);
  }
);

export const searchAIRestaurants = async (data) => {
  try {
    // console.log('🤖 AI 검색 요청 시작:', data);

    const response = await apiClient.post('/restaurants/search-nearby', data);

    // console.log('✅ AI 검색 응답:', {
    //   status: response.status,
    //   dataCount: Array.isArray(response.data) ? response.data.length : 'N/A',
    // });

    return response.data;
  } catch (error) {
    // console.error('❌ searchAIRestaurants 에러:', {
    //   message: error.message,
    //   status: error.response?.status,
    //   url: error.config?.url,
    //   baseURL: error.config?.baseURL,
    // });

    if (error.response?.status === 404) {
      throw new Error(
        'API 엔드포인트를 찾을 수 없습니다. 백엔드 서버가 실행 중인지 확인해주세요.'
      );
    } else if (error.response?.status === 500) {
      throw new Error('서버 내부 오류가 발생했습니다.');
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.');
    } else if (error.code === 'ERR_NETWORK') {
      throw new Error('네트워크 연결을 확인해주세요.');
    }

    throw error;
  }
};

export const testBackendConnection = async () => {
  try {
    // console.log('🔧 백엔드 연결 테스트 시작...');

    const response = await apiClient.post('/restaurants/search-nearby', {
      address: '테스트 주소',
    });

    // console.log('✅ 백엔드 연결 성공:', response.status);
    return { success: true, status: response.status };
  } catch (error) {
    // console.error('❌ 백엔드 연결 실패:', error);
    return {
      success: false,
      error: error.message,
      status: error.response?.status,
    };
  }
};

export const compareRestaurants = async (data) => {
  try {
    const response = await apiClient.post('/restaurants/compare', data);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export { apiClient };
