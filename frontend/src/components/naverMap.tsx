import React, { useEffect, useRef, useState, useCallback } from 'react';

declare global {
  interface Window {
    naver: any;
  }
}

interface Restaurant {
  id: number;
  name: string;
  address: string;
  category: string;
  telephone: string;
  description: string;
  aiRecommendation: string;
  link: string;
  cuisine: string;
  rating: number | null;
  area: string;
  displayDistance: string;
  lat: number;
  lng: number;
  representativeMenus: string[];
  distance?: number;
  priceRange?: string;
}

interface NaverMapProps {
  onLocationSelect?: (location: { lat: number; lng: number }) => void;
  restaurants?: Restaurant[];
}

const NaverMap: React.FC<NaverMapProps> = ({
  onLocationSelect,
  restaurants,
}) => {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const restaurantMarkersRef = useRef<any[]>([]);
  const selectedLocationMarkerRef = useRef<any>(null);
  const currentInfoWindowRef = useRef<any>(null);

  const createModernMarkerContent = (
    type: 'search' | 'restaurant',
    data?: any
  ) => {
    if (type === 'search') {
      return `
        <div style="
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 50%;
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
          border: 3px solid white;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: searchPulse 2s infinite;
        ">
          <div style="
            font-size: 18px;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
          ">👀</div>
        </div>
        <style>
          @keyframes searchPulse {
            0%, 100% { 
              transform: scale(1);
              box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
            }
            50% { 
              transform: scale(1.1);
              box-shadow: 0 12px 35px rgba(102, 126, 234, 0.6);
            }
          }
        </style>
      `;
    } else {
      const { name, index, distance, cuisine } = data;
      const shortName = name.length > 6 ? name.substring(0, 6) + '...' : name;

      const cuisineStyles = {
        한식: { bg: '#ff6b6b', emoji: '🍚' },
        중식: { bg: '#feca57', emoji: '🥢' },
        일식: { bg: '#ff9ff3', emoji: '🍣' },
        양식: { bg: '#54a0ff', emoji: '🍝' },
        치킨: { bg: '#ff9f43', emoji: '🍗' },
        분식: { bg: '#5f27cd', emoji: '🍢' },
        카페: { bg: '#00d2d3', emoji: '☕' },
        피자: { bg: '#ff6348', emoji: '🍕' },
        기타: { bg: '#2ed573', emoji: '🍽️' },
      };

      const style =
        cuisineStyles[cuisine as keyof typeof cuisineStyles] ||
        cuisineStyles['기타'];

      return `
        <div style="
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          filter: drop-shadow(0 4px 12px rgba(0,0,0,0.15));
        " onmouseover="this.style.transform='scale(1.1) translateY(-2px)'" 
           onmouseout="this.style.transform='scale(1) translateY(0)'">
          
          <!-- 메인 마커 -->
          <div style="
            position: relative;
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, ${style.bg} 0%, ${
        style.bg
      }dd 100%);
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 6px 20px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              transform: rotate(45deg);
              font-size: 16px;
              line-height: 1;
            ">${style.emoji}</div>
          </div>
          
          <!-- 순서 번호 -->
          <div style="
            position: absolute;
            top: -8px;
            right: -8px;
            width: 20px;
            height: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            border: 2px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            color: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">${index + 1}</div>
          
          <!-- 정보 카드 -->
          <div style="
            margin-top: 8px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            padding: 6px 10px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            min-width: 80px;
            text-align: center;
          ">
            <div style="
              font-size: 11px;
              font-weight: 600;
              color: #333;
              margin-bottom: 2px;
              line-height: 1.2;
            ">${shortName}</div>
            <div style="
              font-size: 9px;
              color: #666;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 4px;
            ">
              <span>🚶 ${distance}m</span>
              
            </div>
          </div>
        </div>
      `;
    }
  };

  const createModernInfoWindow = (restaurant: Restaurant) => {
    const getDistanceDisplay = () => {
      if (restaurant.distance !== undefined) {
        return `🚶 ${restaurant.distance}m`;
      } else if (restaurant.displayDistance) {
        return `📍 ${restaurant.displayDistance}`;
      } else {
        return '📍 위치 정보';
      }
    };

    return `
  <div style="
    width: 280px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0,0,0,0.15);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    position: relative;
  ">
    <!-- X 버튼 -->
    <button onclick="
      try {
        if (typeof window.closeInfoWindow === 'function') {
          window.closeInfoWindow();
        } else {
          console.error('closeInfoWindow function not found');
        }
      } catch(e) {
        console.error('Error closing InfoWindow:', e);
      }
    " style="
      position: absolute;
      top: 8px;
      right: 8px;
      width: 32px;
      height: 32px;
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 50%;
      color: white;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      transition: all 0.2s ease;
      backdrop-filter: blur(10px);
    " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" 
       onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">
      ×
    </button>
    
    <!-- 헤더 -->
    <div style="
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      padding: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    ">
      <h3 style="
        margin: 0 0 8px 0;
        color: white;
        font-size: 16px;
        font-weight: 600;
        line-height: 1.3;
        padding-right: 40px;
      ">${restaurant.name}</h3>
      <div style="
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      ">
        ${
          restaurant.cuisine
            ? `
          <span style="
            background: rgba(255, 255, 255, 0.2);
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
          ">${restaurant.cuisine}</span>
        `
            : ''
        }
        <span style="
          background: rgba(255, 255, 255, 0.2);
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        ">${getDistanceDisplay()}</span>
      </div>
    </div>
    
    <!-- 콘텐츠 -->
    <div style="
      background: white;
      padding: 16px;
    ">
      ${
        restaurant.priceRange
          ? `
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        ">
           
          ${
            restaurant.priceRange
              ? `
            <div style="
              background: #f5f5f5;
              padding: 4px 8px;
              border-radius: 8px;
              font-size: 12px;
              color: #666;
              font-weight: 500;
            ">💰 ${restaurant.priceRange}</div>
          `
              : ''
          }
        </div>
      `
          : ''
      }
      
      <!-- 음식점 정보 -->
      <div style="
        text-align: center;
        padding: 8px 0;
        color: #666;
        font-size: 14px;
      ">
        ${restaurant.name}의 위치입니다
      </div>
    </div>
  </div>
  `;
  };

  const clearRestaurantMarkers = useCallback(() => {
    restaurantMarkersRef.current.forEach((marker) => {
      marker.setMap(null);
    });
    restaurantMarkersRef.current = [];
  }, []);

  const clearSelectedLocationMarker = useCallback(() => {
    if (selectedLocationMarkerRef.current) {
      selectedLocationMarkerRef.current.setMap(null);
      selectedLocationMarkerRef.current = null;
    }
  }, []);

  const closeCurrentInfoWindow = useCallback(() => {
    if (currentInfoWindowRef.current) {
      currentInfoWindowRef.current.close();
      currentInfoWindowRef.current = null;
    }
  }, []);

  const handleMapClick = useCallback(
    (e: any) => {
      const latlng = e.coord;

      if (window.naver && window.naver.maps.Service) {
        window.naver.maps.Service.reverseGeocode(
          {
            coords: latlng,
            orders: [
              window.naver.maps.Service.OrderType.ADDR,
              window.naver.maps.Service.OrderType.ROAD_ADDR,
            ].join(','),
          },
          (status: any, response: any) => {
            if (status === window.naver.maps.Service.Status.OK) {
              const result = response.v2;
              const address = result.address;
              const fullAddress = address.jibunAddress || address.roadAddress;

              console.log('🎯 Geocoder 기반 정확한 위치:', {
                lat: latlng.lat(),
                lng: latlng.lng(),
                address: fullAddress,
              });

              clearSelectedLocationMarker();
              clearRestaurantMarkers();
              closeCurrentInfoWindow();

              const selectedMarker = new window.naver.maps.Marker({
                position: latlng,
                map: mapRef.current,
                title: '검색 기준점',
                icon: {
                  content: createModernMarkerContent('search'),
                  anchor: new window.naver.maps.Point(24, 24),
                },
              });

              selectedLocationMarkerRef.current = selectedMarker;

              if (onLocationSelect) {
                onLocationSelect({
                  lat: latlng.lat(),
                  lng: latlng.lng(),
                  address: fullAddress,
                });
              }
            }
          }
        );
      }
    },
    [
      onLocationSelect,
      clearSelectedLocationMarker,
      clearRestaurantMarkers,
      closeCurrentInfoWindow,
    ]
  );

  useEffect(() => {
    const loadNaverMapScript = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.naver && window.naver.maps) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = `https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${process.env.REACT_APP_NAVER_CLIENT_ID}`;
        script.async = true;

        script.onload = () => resolve();
        script.onerror = () => reject(new Error('네이버 지도 API 로드 실패'));

        document.head.appendChild(script);
      });
    };

    const initializeMap = async () => {
      try {
        await loadNaverMapScript();

        if (!mapElement.current || mapRef.current) return;

        (window as any).closeInfoWindow = () => {
          console.log('🔴 closeInfoWindow 호출됨');
          closeCurrentInfoWindow();
        };

        const mapOptions = {
          center: new window.naver.maps.LatLng(37.5665, 126.978),
          zoom: 10,
          mapTypeControl: true,
          mapTypeControlOptions: {
            style: window.naver.maps.MapTypeControlStyle.BUTTON,
            position: window.naver.maps.Position.TOP_RIGHT,
          },
          zoomControl: true,
          zoomControlOptions: {
            style: window.naver.maps.ZoomControlStyle.SMALL,
            position: window.naver.maps.Position.TOP_LEFT,
          },
        };

        const map = new window.naver.maps.Map(mapElement.current, mapOptions);
        mapRef.current = map;

        window.naver.maps.Event.addListener(map, 'click', handleMapClick);

        setIsMapLoaded(true);
        console.log('✅ 지도 초기화 완료 - 사용자 클릭 대기 중');
      } catch (error) {
        console.error('❌ 지도 초기화 실패:', error);
      }
    };

    initializeMap();

    return () => {
      if ((window as any).closeInfoWindow) {
        delete (window as any).closeInfoWindow;
      }
      clearRestaurantMarkers();
      clearSelectedLocationMarker();
      closeCurrentInfoWindow();
    };
  }, [
    handleMapClick,
    clearRestaurantMarkers,
    clearSelectedLocationMarker,
    closeCurrentInfoWindow,
  ]);

  useEffect(() => {
    if (
      !isMapLoaded ||
      !mapRef.current ||
      !restaurants ||
      restaurants.length === 0
    )
      return;

    console.log('🍽️ 현대적 음식점 마커 생성:', restaurants.length, '개');

    clearRestaurantMarkers();
    closeCurrentInfoWindow();

    restaurants.forEach((restaurant, index) => {
      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(restaurant.lat, restaurant.lng),
        map: mapRef.current,
        title: restaurant.name,
        icon: {
          content: createModernMarkerContent('restaurant', {
            name: restaurant.name,
            index,
            distance: restaurant.distance,
            cuisine: restaurant.cuisine,
            rating: restaurant.rating,
          }),
          anchor: new window.naver.maps.Point(22, 50),
        },
      });

      window.naver.maps.Event.addListener(marker, 'click', () => {
        closeCurrentInfoWindow();

        const infoWindow = new window.naver.maps.InfoWindow({
          content: createModernInfoWindow(restaurant),
          borderWidth: 0,
          backgroundColor: 'transparent',
          anchorSkew: true,
          anchorSize: new window.naver.maps.Size(20, 10),
          pixelOffset: new window.naver.maps.Point(0, -10),
        });

        infoWindow.open(mapRef.current, marker);
        currentInfoWindowRef.current = infoWindow;
      });

      restaurantMarkersRef.current.push(marker);
    });

    if (restaurants.length > 0) {
      const bounds = new window.naver.maps.LatLngBounds();

      if (selectedLocationMarkerRef.current) {
        bounds.extend(selectedLocationMarkerRef.current.getPosition());
      }

      restaurants.forEach((restaurant) => {
        bounds.extend(
          new window.naver.maps.LatLng(restaurant.lat, restaurant.lng)
        );
      });

      mapRef.current.fitBounds(bounds, {
        top: 60,
        right: 60,
        bottom: 60,
        left: 60,
      });
    }
  }, [
    isMapLoaded,
    restaurants,
    clearRestaurantMarkers,
    closeCurrentInfoWindow,
  ]);

  return (
    <div
      className="card-glass"
      style={{ height: '400px', position: 'relative' }}
    >
      <div
        ref={mapElement}
        style={{ width: '100%', height: '100%', borderRadius: '12px' }}
      />

      {isMapLoaded && !selectedLocationMarkerRef.current && (
        <div className="absolute top-4 left-4 right-4 glass-card p-4 rounded-xl text-center z-10 animate-fade-in-up"></div>
      )}

      {!isMapLoaded && (
        <div className="absolute inset-0 flex-center bg-white bg-opacity-90 backdrop-blur-sm rounded-xl">
          <div className="text-center">
            <div className="loading-spinner mx-auto mb-4"></div>
            <div className="text-sm text-gray-600">지도를 로딩 중입니다...</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NaverMap;
