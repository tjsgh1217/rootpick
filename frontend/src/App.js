import NaverMap from './components/naverMap.tsx';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { searchNearbyRestaurants, getRestaurantReview } from './api';
import './App.css';

function App() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
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

      setTimeout(() => {
        scrollToResults();
      }, 100);

      try {
        const requestData = {
          lat: location.lat,
          lng: location.lng,
          address: `위도 ${location.lat}, 경도 ${location.lng}`,
        };

        const aiRestaurants = await searchNearbyRestaurants(requestData);

        if (!Array.isArray(aiRestaurants)) {
          throw new Error('API 응답이 배열 형태가 아닙니다.');
        }

        setRestaurants(aiRestaurants);

        setTimeout(() => {
          scrollToResults();
        }, 200);
      } catch (error) {
        console.error('❌ 음식점 검색 실패:', error);
        setError(`검색 실패: ${error.message}`);
        setRestaurants([]);
      } finally {
        setLoading(false);
      }
    },
    [scrollToResults]
  );

  const handleRestaurantReview = useCallback(
    async (restaurant) => {
      if (!selectedLocation) return;

      try {
        setLoading(true);

        const review = await getRestaurantReview({
          name: restaurant.name,
          location: `${
            restaurant.area || ''
          } 위도 ${selectedLocation.lat.toFixed(
            6
          )}, 경도 ${selectedLocation.lng.toFixed(6)}`,
        });

        showReviewModal(restaurant.name, review);
      } catch (error) {
        console.error('리뷰 생성 실패:', error);
        setError(`리뷰 생성 실패: ${error.message}`);
      } finally {
        setLoading(false);
      }
    },
    [selectedLocation]
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
            <div className="loading-container" data-scroll-reveal>
              <div className="loading-animation">
                <div className="loading-spinner" aria-label="로딩 중" />
                <p>AI가 맛집을 분석하고 있습니다...</p>
                {selectedLocation && (
                  <p className="loading-location">
                    <span role="img" aria-label="위치">
                      📍
                    </span>
                    {selectedLocation.lat.toFixed(4)},{' '}
                    {selectedLocation.lng.toFixed(4)}
                  </p>
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
                  onReviewClick={handleRestaurantReview}
                  loading={loading}
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

const RestaurantCard = React.memo(
  ({ restaurant, index, onReviewClick, loading }) => {
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
        </div>

        {restaurant.description && (
          <div className="relative backdrop-blur-md bg-white/30 rounded-2xl p-4 border border-white/20 shadow-2xl hover:bg-white/40 transition-all duration-500 mb-6">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-400/10 via-purple-400/5 to-pink-400/10 rounded-2xl"></div>
            <div className="relative">
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-xs font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 uppercase tracking-wider">
                  Category
                </span>
              </div>
              <p className="text-sm font-medium text-slate-700 leading-relaxed">
                {restaurant.description}
              </p>
            </div>
          </div>
        )}

        {(restaurant.rating || restaurant.priceRange) && (
          <div className="restaurant-meta">
            {restaurant.rating && (
              <span>
                <span role="img" aria-label="별점">
                  ⭐
                </span>
                {restaurant.rating}
              </span>
            )}
            {restaurant.priceRange && (
              <span>
                <span role="img" aria-label="가격">
                  💰
                </span>
                {restaurant.priceRange}
              </span>
            )}
          </div>
        )}

        <button
          onClick={() => onReviewClick(restaurant)}
          className="review-button interactive"
          disabled={loading}
          aria-label={`${restaurant.name} 상세 리뷰 보기`}
        >
          {loading ? (
            <span className="button-loading">
              <div className="mini-spinner" />
              처리 중...
            </span>
          ) : (
            <>
              AI 상세 리뷰 보기
              <div className="button-hover-effect" />
            </>
          )}
        </button>
      </article>
    );
  }
);

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

const showReviewModal = (restaurantName, review) => {
  const modal = document.createElement('div');
  modal.className = 'review-modal';
  modal.innerHTML = `
    <div class="modal-backdrop" onclick="this.parentElement.remove()">
      <div class="modal-content" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3>${restaurantName} 리뷰</h3>
          <button class="modal-close" onclick="this.closest('.review-modal').remove()">×</button>
        </div>
        <div class="modal-body">
          <p>${review}</p>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" onclick="this.closest('.review-modal').remove()">
            확인
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  requestAnimationFrame(() => {
    modal.classList.add('modal-show');
  });
};

export default App;
