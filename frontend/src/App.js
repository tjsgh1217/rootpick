import NaverMap from './components/naverMap.tsx';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { searchAIRestaurants } from './api';
import './App.css';

function App() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingReviewId] = useState(null);
  const [error, setError] = useState(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const mapSectionRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = Math.min(scrollTop / docHeight, 1);
      setScrollProgress(progress);
    };

    const throttledScroll = throttle(handleScroll, 16);
    window.addEventListener('scroll', throttledScroll, { passive: true });
    return () => window.removeEventListener('scroll', throttledScroll);
  }, []);

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    const revealElements = document.querySelectorAll('[data-scroll-reveal]');
    revealElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [restaurants]);

  const scrollToResults = useCallback(() => {
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest',
      });
    }
  }, []);

  const handleLocationSelect = useCallback(
    async (location) => {
      console.log('🎯 선택된 위치:', location);

      if (!location || !location.address) {
        console.error('❌ 주소 정보가 없습니다:', location);
        setError('주소 정보가 필요합니다.');
        return;
      }

      setSelectedLocation(location);
      setLoading(true);
      setError(null);
      setRestaurants([]);

      setTimeout(() => {
        scrollToResults();
      }, 100);

      try {
        const requestData = {
          address: location.address,
          lat: location.lat,
          lng: location.lng,
        };

        console.log('🏠 주소 기반 검색 요청:', requestData);

        const aiRestaurants = await searchAIRestaurants(requestData);

        if (!Array.isArray(aiRestaurants)) {
          throw new Error('API 응답이 배열 형태가 아닙니다.');
        }

        setRestaurants(aiRestaurants);

        setTimeout(() => {
          scrollToResults();
        }, 200);
      } catch (error) {
        console.error('❌ 주소 기반 검색 실패:', error);
        setError(`검색 실패: ${error.message}`);
        setRestaurants([]);
      } finally {
        setLoading(false);
      }
    },
    [scrollToResults]
  );

  const scrollToSection = useCallback((ref) => {
    ref.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  return (
    <div className="scroll-landing-page">
      <div
        className="scroll-progress-bar"
        style={{ width: `${scrollProgress * 100}%` }}
        role="progressbar"
        aria-label="페이지 스크롤 진행률"
        aria-valuenow={Math.round(scrollProgress * 100)}
        aria-valuemin="0"
        aria-valuemax="100"
      />
      <section
        ref={heroRef}
        className="hero-section"
        aria-label="메인 히어로 섹션"
      >
        <div className="hero-background">
          <div className="floating-elements" aria-hidden="true">
            {['🍜', '🍕', '🍗', '🍣', '☕', '🥘'].map((emoji, index) => (
              <div
                key={emoji}
                className={`float-element float-${index + 1}`}
                style={{ animationDelay: `${index * -3}s` }}
              >
                {emoji}
              </div>
            ))}
          </div>
          <div className="hero-content">
            <h1 className="hero-title">
              <span className="title-line-1 animate-fade-in-up">루트픽</span>
            </h1>
            <p
              className="hero-subtitle animate-fade-in-up"
              style={{ animationDelay: '0.6s' }}
            >
              지도 한 번 클릭으로 숨겨진 맛집을 발견하세요
            </p>

            <div
              className="hero-cta animate-fade-in-up"
              style={{ animationDelay: '0.9s' }}
            ></div>

            <div
              className="hero-stats animate-fade-in-up"
              style={{ animationDelay: '1.2s', transform: 'translateY(20px)' }}
            >
              <div className="stat-item">
                <span className="stat-number">10K+</span>
                <span className="stat-label">추천 맛집</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">99%</span>
                <span className="stat-label">정확도</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">24/7</span>
                <span className="stat-label">서비스</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section
        ref={featuresRef}
        className="features-section"
        aria-label="서비스 특징"
      >
        <div className="container mx-auto px-6">
          <div className="features-grid">
            {[
              {
                icon: '⚡',
                title: '실시간 분석',
                description:
                  'AI가 실시간으로 위치를 분석하여 최적의 맛집을 추천합니다',
                delay: '0ms',
              },
              {
                icon: '🎯',
                title: '정확한 위치',
                description: 'GPS 기반으로 정확한 거리와 방향을 제공합니다',
                delay: '200ms',
              },
              {
                icon: '🌟',
                title: '큐레이션',
                description: '음식점에 대한 다양한 후기를 제공합니다',
                delay: '400ms',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="feature-card hover-lift-modern"
                data-scroll-reveal
                style={{ animationDelay: feature.delay }}
              >
                <div
                  className="feature-icon"
                  role="img"
                  aria-label={feature.title}
                >
                  {feature.icon}
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        ref={mapSectionRef}
        className="map-section"
        id="main-content"
        aria-label="지도 선택 섹션"
      >
        <div className="container mx-auto px-6">
          <div className="map-container">
            <div className="map-header text-center mb-8">
              <h2 className="map-title">
                <span className="title-icon" role="img" aria-label="위치">
                  📍
                </span>
                지도에서 위치를 선택하세요
              </h2>
              <p className="map-description">
                원하는 위치을 클릭하면 AI가 가장 가까운 맛집을 찾아드립니다
              </p>
            </div>

            <div className="map-wrapper">
              <NaverMap
                onLocationSelect={handleLocationSelect}
                restaurants={restaurants}
              />
            </div>
          </div>
        </div>
      </section>

      <section
        ref={resultsRef}
        className="results-section"
        aria-label="검색 결과"
      >
        <div className="container mx-auto px-6">
          <div className="results-header text-center mb-12">
            <h2 className="results-title">
              추천 맛집
              {restaurants.length > 0 && (
                <span className="results-count">{restaurants.length}개</span>
              )}
            </h2>
          </div>

          {error && (
            <div className="alert-error" data-scroll-reveal role="alert">
              <span role="img" aria-label="경고">
                ⚠️
              </span>
              {error}
            </div>
          )}

          {loading && (
            <div className="loading-container">
              <div className="loading-animation">
                <div className="loading-spinner" aria-label="로딩 중" />

                {selectedLocation && (
                  <p className="loading-location">{selectedLocation.address}</p>
                )}
              </div>
            </div>
          )}

          {restaurants.length === 0 && !loading && !error && (
            <div className="empty-state" data-scroll-reveal>
              <div className="empty-icon" role="img" aria-label="지도">
                🗺️
              </div>
              <h3>위치를 선택해주세요</h3>
              <button
                className="btn-primary"
                onClick={() => scrollToSection(mapSectionRef)}
              >
                지도로 이동
              </button>
            </div>
          )}

          {restaurants.length > 0 && (
            <div className="restaurants-grid">
              {restaurants.map((restaurant, index) => (
                <RestaurantCard
                  key={`${restaurant.name}-${index}`}
                  restaurant={restaurant}
                  index={index}
                  loading={loadingReviewId === restaurant.id}
                />
              ))}
            </div>
          )}

          {selectedLocation && (
            <div className="location-info" data-scroll-reveal>
              <strong>검색한 위치</strong>
              <div className="coordinates">
                위도: {selectedLocation.lat.toFixed(6)} | 경도:{' '}
                {selectedLocation.lng.toFixed(6)}
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="app-footer" role="contentinfo">
        <div className="container mx-auto px-6 text-center">
          <div className="footer-content">
            <p>tjsgh1217@gmail.com</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

const RestaurantCard = React.memo(({ restaurant, index }) => {
  const getCuisineStyle = (cuisine) => {
    if (cuisine?.includes('한식')) {
      return 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg';
    }
    if (cuisine?.includes('중식')) {
      return 'bg-gradient-to-r from-red-500 to-red-700 text-white shadow-lg';
    }
    if (cuisine?.includes('일식')) {
      return 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg';
    }
    if (cuisine?.includes('피자')) {
      return 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg';
    }
    if (cuisine?.includes('카페')) {
      return 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg';
    }
    if (cuisine?.includes('치킨')) {
      return 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white shadow-lg';
    }
    if (cuisine?.includes('베이커리')) {
      return 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-lg';
    }
    return 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-lg';
  };

  const handleLinkClick = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCallClick = (phone) => {
    window.location.href = `tel:${phone}`;
  };

  const openNaverMap = (lat, lng, name) => {
    const url = `https://map.naver.com/v5/search/${encodeURIComponent(
      name
    )}/place/${lat},${lng}`;
    window.open(url, '_blank');
  };

  return (
    <article
      className="restaurant-card hover-lift-modern"
      data-scroll-reveal
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="card-header">
        <div className="restaurant-number">{index + 1}</div>
        <h3 className="restaurant-name">{restaurant.name}</h3>
        <div className="restaurant-badges">
          {restaurant.area && (
            <span className="badge area-badge">
              <span role="img" aria-label="위치">
                📍
              </span>
              {restaurant.area}
            </span>
          )}

          {restaurant.cuisine && (
            <span
              className={`px-3 py-1 rounded-full font-semibold text-sm transform hover:scale-105 transition-all duration-200 ${getCuisineStyle(
                restaurant.cuisine
              )}`}
            >
              {restaurant.cuisine}
            </span>
          )}

          <span className="badge distance-badge">
            <span role="img" aria-label="걷기">
              🚶
            </span>
            {restaurant.displayDistance || `${restaurant.distance}m`}
          </span>
        </div>

        {restaurant.address && (
          <div className="restaurant-address">
            <span className="address-text ml-2">{restaurant.address}</span>
          </div>
        )}
      </div>

      <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-semibold text-green-700 ml-2">
              전화번호
            </span>
          </div>
          {restaurant.telephone ? (
            <button
              onClick={() => handleCallClick(restaurant.telephone)}
              className="inline-flex items-center space-x-1 bg-green-100 hover:bg-green-200 text-green-800 text-xs px-3 py-1 rounded-full font-medium border border-green-200 transition-colors"
            >
              <span>📞 {restaurant.telephone}</span>
            </button>
          ) : (
            <span className="inline-flex items-center space-x-1 bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full font-medium border border-gray-200">
              <span>📞 알 수 없음</span>
            </span>
          )}
        </div>
      </div>

      {restaurant.link && (
        <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-blue-600">
                {restaurant.link.includes('instagram')
                  ? '📷 Instagram'
                  : restaurant.link.includes('facebook')
                  ? '👥 Facebook'
                  : restaurant.link.includes('blog')
                  ? '📝 Blog'
                  : '🔗 Website'}
              </span>
            </div>
            <button
              onClick={() => handleLinkClick(restaurant.link)}
              className="inline-flex items-center space-x-1 bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs px-3 py-1 rounded-full font-medium border border-blue-200 transition-colors"
            >
              <span>방문하기</span>
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg border border-orange-200 mb-4">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-sm font-semibold text-orange-700 ml-2">
            대표 메뉴
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {restaurant.representativeMenus &&
          restaurant.representativeMenus.length > 0 ? (
            restaurant.representativeMenus.map((menu, index) => (
              <span
                key={index}
                className="inline-block bg-orange-100 text-orange-800 text-xs px-3 py-1 rounded-full font-medium border border-orange-200 hover:bg-orange-200 transition-colors"
              >
                {menu}
              </span>
            ))
          ) : (
            <span className="inline-block bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full font-medium border border-gray-200">
              알 수 없음
            </span>
          )}
        </div>
      </div>

      {restaurant.description && (
        <div className="relative backdrop-blur-md bg-white/30 rounded-2xl p-4 border border-white/20 shadow hover:bg-white/40 transition-all duration-500 mb-6">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-400/10 via-purple-400/5 to-pink-400/10 rounded-2xl"></div>
          <div className="relative">
            <div className="flex items-center space-x-2 mb-3">
              <span className="text-xs font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 uppercase tracking-wider">
                정보
              </span>
            </div>
            <p className="text-sm font-medium text-slate-700 leading-relaxed">
              {restaurant.description}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={() =>
            openNaverMap(restaurant.lat, restaurant.lng, restaurant.name)
          }
          className="group flex-1 relative inline-flex justify-center items-center bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 hover:from-slate-100 hover:via-gray-100 hover:to-slate-100 active:from-slate-200 active:via-gray-200 active:to-slate-200 border border-slate-200/60 hover:border-slate-300/80 text-slate-600 hover:text-slate-800 font-medium text-sm px-4 py-3 rounded-xl transition-all duration-300 shadow-sm hover:shadow-lg hover:shadow-slate-200/50 focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:ring-offset-1 backdrop-blur-sm overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          <div className="relative z-10 flex items-center">
            <svg
              className="w-4 h-4 mr-2.5 text-slate-500 group-hover:text-slate-700 transition-colors duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>

            <span className="relative z-10 tracking-wide">
              네이버 지도에서 보기
            </span>
          </div>

          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-300/50 to-transparent" />
          </div>
        </button>
      </div>
    </article>
  );
});

const throttle = (func, limit) => {
  let inThrottle;
  return function () {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

export default App;
