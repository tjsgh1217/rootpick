import NaverMap from './components/naverMap.tsx';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { searchAIRestaurants } from './api';
import './App.css';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

function App() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingReviewId] = useState(null);
  const [error, setError] = useState(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareResult, setCompareResult] = useState('');
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState('');
  const [mapVisible, setMapVisible] = useState(false);

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

  useEffect(() => {
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMapVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    if (mapSectionRef.current) {
      observer.observe(mapSectionRef.current);
    }
    return () => observer.disconnect();
  }, []);

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
    if (ref.current) {
      ref.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      setTimeout(() => {
        window.scrollBy({ top: -30, left: 0, behavior: 'smooth' });
      }, 400);
    }
  }, []);

  const handleCompare = async () => {
    try {
      setCompareLoading(true);
      setCompareError('');
      setCompareResult('');
      setCompareModalOpen(true);

      const res = await axios.post('/restaurants/compare', {
        restaurants: restaurants,
      });

      setCompareResult(res.data.result);
    } catch (e) {
      setCompareError('AI 비교 결과를 가져오지 못했습니다.');
    } finally {
      setCompareLoading(false);
    }
  };

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
        className="relative min-h-screen bg-gradient-to-br from-slate-700 via-gray-800 to-zinc-800 overflow-hidden"
        aria-label="메인 히어로 섹션"
      >
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-white/5"></div>

          <div className="absolute inset-0 pointer-events-none">
            {['🍜', '🍕', '🍗', '🍣', '☕', '🥘', '🍰', '🍺'].map(
              (emoji, i) => (
                <span
                  key={emoji}
                  className={`
                  absolute text-3xl md:text-4xl opacity-20 animate-[float_20s_linear_infinite]
                  ${i === 0 && 'top-16 left-16'}
                  ${i === 1 && 'top-1/3 right-20'}
                  ${i === 2 && 'bottom-1/4 left-1/4'}
                  ${i === 3 && 'top-2/3 right-1/3'}
                  ${i === 4 && 'bottom-1/3 right-16'}
                  ${i === 5 && 'top-1/2 left-8'}
                  ${i === 6 && 'bottom-1/2 right-8'}
                  ${i === 7 && 'top-1/4 left-1/3'}
                `}
                  style={{ animationDelay: `${i * -2.5}s` }}
                  aria-hidden="true"
                >
                  {emoji}
                </span>
              )
            )}
          </div>

          <div className="absolute top-20 left-10 w-32 h-32 bg-white/5 rounded-full blur-xl"></div>
          <div className="absolute bottom-20 right-10 w-40 h-40 bg-pink-300/10 rounded-full blur-xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-400/5 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-center min-h-screen px-6 py-12">
          <div className="flex-1 max-w-2xl text-center lg:text-left lg:pr-12 mb-12 lg:mb-0">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 text-white/90 text-sm font-medium animate-fade-in-up ml-4 mb-4">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Naver API + Gemini AI 기반
              </div>

              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-white leading-tight animate-fade-in-up">
                <span className="block">루트픽</span>
                <span className="block text-2xl md:text-3xl lg:text-4xl font-normal text-white/80 mt-4 ml-14 mb-40">
                  RootPick
                </span>
              </h1>

              <p
                className="text-xl md:text-2xl font-medium text-white/90 leading-relaxed animate-fade-in-up"
                style={{ animationDelay: '0.3s' }}
              >
                정확한{' '}
                <span className="text-yellow-300 font-semibold">
                  좌표 기반 거리 계산
                </span>
                과<br />
                <span className="text-blue-300 font-semibold">
                  AI 맛집 추천
                </span>
                으로
                <br />
                진짜 맛집을 찾아드려요
              </p>
            </div>
          </div>

          <div className="flex-1 max-w-md lg:max-w-lg">
            <div
              className="grid grid-cols-2 gap-6 animate-fade-in-up"
              style={{ animationDelay: '0.6s' }}
            >
              <div className="stat-card">
                <div className="stat-number">실시간</div>
                <div className="stat-label">거리 계산</div>
              </div>

              <div className="stat-card">
                <div className="stat-number">AI</div>
                <div className="stat-label">맛집 추천</div>
              </div>

              <div className="stat-card">
                <div className="stat-number">정확한</div>
                <div className="stat-label">좌표 정보</div>
              </div>

              <div className="stat-card">
                <div className="stat-number">실시간</div>
                <div className="stat-label">검색 결과</div>
              </div>
            </div>

            <div
              className="mt-24 space-y-3 animate-fade-in-up"
              style={{ animationDelay: '0.9s' }}
            >
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-2 h-2 bg-lime-600 rounded-full border border-white shadow"></div>
                <span>Naver Dynamic Map API로 직관적인 지도 제공</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-2 h-2 bg-lime-500 rounded-full border border-white shadow"></div>{' '}
                <span>Naver Reverse Geocoding API로 좌표를 주소로 변환 </span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-2 h-2 bg-lime-400 rounded-full border border-white shadow"></div>

                <span>Naver Search API로 실시간 음식점 검색</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-2 h-2 bg-lime-300 rounded-full border border-white shadow"></div>
                <span>Naver Direction API로 거리 및 소요 시간 계산</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-2 h-2 bg-lime-200 rounded-full border border-white shadow"></div>
                <span>Google Gemini AI로 음식점 비교 인사이트 제공</span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white/60 rounded-full mt-2 animate-pulse"></div>
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
                  'AI가 위치 기반 맛집을 맛, 분위기, 거리 등 다양한 기준으로 분석합니다',
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
                description: '음식점에 대한 다양한 정보를 제공합니다',
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
        className="map-section relative overflow-hidden bg-gradient-to-br from-slate-900 via-gray-900 to-zinc-900"
        id="main-content"
        aria-label="지도 선택 섹션"
      >
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-transparent to-white/5"></div>

          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div
            className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/8 rounded-full blur-3xl animate-pulse"
            style={{ animationDelay: '2s' }}
          ></div>
          <div
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl animate-pulse"
            style={{ animationDelay: '4s' }}
          ></div>

          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px]"></div>
        </div>

        <div className="container mx-auto px-10 relative z-10">
          <div className="map-container">
            <div className="map-header text-center mb-12">
              <div
                className={`inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-full px-6 py-3 text-white/90 text-base font-semibold mb-14 shadow-lg ${
                  mapVisible ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={mapVisible ? { animationDelay: '0.2s' } : {}}
              >
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                AI 맛집 추천 시스템
              </div>

              <h2
                className={`map-title mb-4 text-4xl md:text-5xl font-extrabold tracking-tight text-white drop-shadow-lg ${
                  mapVisible ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={mapVisible ? { animationDelay: '0.4s' } : {}}
              >
                지도에서 위치를 선택하세요
              </h2>

              <p
                className={`map-description mb-8 text-lg md:text-xl font-medium text-white/90 ${
                  mapVisible ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={mapVisible ? { animationDelay: '0.6s' } : {}}
              >
                원하는 위치를 클릭하면 근처의 맛집을 찾아{' '}
                <span className="text-yellow-300 font-bold">AI </span>가
                비교해드립니다
              </p>

              <div
                className={`flex flex-wrap justify-center gap-4 mt-6 ${
                  mapVisible ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={mapVisible ? { animationDelay: '0.8s' } : {}}
              >
                {[
                  {
                    color: 'from-green-400 to-emerald-500',
                    text: '실시간 거리 계산',
                  },
                  {
                    color: 'from-blue-400 to-indigo-500',
                    text: 'AI 기반 추천',
                  },
                  {
                    color: 'from-purple-400 to-pink-400',
                    text: '정확한 좌표 정보',
                  },
                ].map((item, idx) => (
                  <div
                    key={item.text}
                    className={`px-5 py-2 rounded-full bg-gradient-to-r ${item.color} text-white font-semibold shadow-md text-sm md:text-base flex items-center gap-2`}
                    style={
                      mapVisible
                        ? { animationDelay: `${0.9 + idx * 0.1}s` }
                        : {}
                    }
                  >
                    <span className="w-2 h-2 bg-white/80 rounded-full"></span>
                    {item.text}
                  </div>
                ))}
              </div>
            </div>

            <div className="map-wrapper relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-blue-500/8 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm"></div>
              <div
                className={`relative z-10 ${
                  mapVisible ? 'animate-fade-in-up' : 'opacity-0'
                }`}
                style={mapVisible ? { animationDelay: '1.2s' } : {}}
              >
                <NaverMap
                  onLocationSelect={handleLocationSelect}
                  restaurants={restaurants}
                />
              </div>
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
          <div className="results-header text-center mb-12 flex items-center justify-center gap-4">
            <h2 className="results-title mb-0">
              추천 맛집
              {restaurants.length > 0 && (
                <span className="results-count">{restaurants.length}개</span>
              )}
            </h2>
            {restaurants.length >= 2 && (
              <button
                onClick={handleCompare}
                className="ml-4 px-6 py-3 rounded-xl bg-gradient-to-r from-green-200 to-emerald-300 text-green-900 font-semibold text-base shadow-sm border border-green-200 hover:from-green-300 hover:to-emerald-400 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-200/50 focus:ring-offset-1"
                style={{ minWidth: 120 }}
              >
                AI 비교
              </button>
            )}
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

      {compareModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 relative animate-fade-in-up">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl font-bold focus:outline-none"
              onClick={() => setCompareModalOpen(false)}
              aria-label="비교 결과 닫기"
            >
              ×
            </button>
            <h3 className="text-xl font-bold mb-4 text-center text-purple-700">
              AI 음식점 비교 결과
            </h3>
            {compareLoading && (
              <div className="flex flex-col items-center py-8">
                <div className="loading-spinner mb-4" />
                <div className="text-gray-500">AI가 비교 중입니다...</div>
              </div>
            )}
            {compareError && (
              <div className="alert-error my-4">{compareError}</div>
            )}
            {!compareLoading && !compareError && compareResult && (
              <div className="prose max-w-full overflow-x-auto">
                <ReactMarkdown>{compareResult}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}
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

      <div className="flex gap-2 mt-4 items-center">
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
