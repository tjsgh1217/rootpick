// naver-place-crawler.service.ts - HTML 구조에 맞춘 최종 수정
import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

export interface NaverPlaceData {
  name: string;
  rating: number;
  reviewCount: number;
  blogReviewCount: number;
  priceRange: string;
  operatingHours: string;
  menus: { name: string; price: string }[];
  reviews: { rating: number; content: string }[];
  facilities: string[];
  keywords: string[];
  photos: string[];
}

@Injectable()
export class NaverPlaceCrawlerService {
  private browser: puppeteer.Browser | null = null;

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
        ],
      });
    }
  }

  async crawlRestaurantData(
    restaurantName: string,
    address: string,
  ): Promise<NaverPlaceData | null> {
    let page: puppeteer.Page | null = null;

    try {
      await this.initBrowser();
      page = await this.browser!.newPage();

      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );

      await page.setViewport({ width: 1920, height: 1080 });

      page.on('console', (msg) => {
        console.log('[브라우저 콘솔]', msg.text());
      });

      const mapSearchUrl = `https://map.naver.com/v5/search/${encodeURIComponent(restaurantName)}`;
      console.log(`🔍 네이버 지도 직접 검색: ${restaurantName}`);

      await page.goto(mapSearchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      await new Promise((resolve) => setTimeout(resolve, 8000));

      const frames = page.frames();
      for (const frame of frames) {
        console.log('iframe url:', frame.url());
      }
      const targetFrame = frames.find((f) => f.url().includes('place/list'));
      if (targetFrame) {
        const results = await targetFrame.evaluate(() => {
          const selectors = [
            'li.VLTHu.OW9LQ',
            'li.place_bluelink',
            'li[data-testid*="place"]',
            'li[class*="place"]',
            'li[class*="restaurant"]',
            'li[class*="item"]',
          ];

          let elements: Element[] = [];
          for (const selector of selectors) {
            const found = document.querySelectorAll(selector);
            if (found.length > 0) {
              console.log(`선택자 ${selector}에서 ${found.length}개 요소 발견`);
              elements = Array.from(found);
              break;
            }
          }

          const allLis = document.querySelectorAll('li');
          console.log('모든 li 요소들:');
          allLis.forEach((li, index) => {
            console.log(
              `${index}: class="${li.className}", text="${(li as HTMLElement).innerText.substring(0, 50)}..."`,
            );
          });

          return elements.map((li) => (li as HTMLElement).innerText);
        });
        console.log('음식점 리스트 결과:', results);

        if (results.length > 0) {
          const restaurantText = results[0];
          const lines = restaurantText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);

          const name =
            lines.find(
              (line) => line.includes('오뜨로') || line.includes('꾸아'),
            ) || '';
          const category =
            lines.find((line) =>
              [
                '한식',
                '양식',
                '중식',
                '일식',
                '카페',
                '분식',
                '고기',
                '치킨',
                '피자',
                '술집',
              ].some((cat) => line.includes(cat)),
            ) || '';
          const address =
            lines.find(
              (line) =>
                line.includes('구 ') ||
                line.includes('동 ') ||
                line.includes('로 ') ||
                line.includes('길 '),
            ) || '';
          const status = lines.find((line) => line.includes('영업')) || '';

          console.log('✅ iframe에서 파싱된 음식점 정보:', {
            name,
            category,
            address,
            status,
          });

          const result: NaverPlaceData = {
            name: name,
            rating: 0,
            reviewCount: 0,
            blogReviewCount: 0,
            priceRange: '',
            operatingHours: status,
            menus: [],
            reviews: [],
            facilities: [],
            keywords: [category],
            photos: [],
          };

          console.log('✅ 최종 추출 데이터:', JSON.stringify(result, null, 2));

          console.log('🔍 상세 페이지로 이동 중...');

          const clickResult = await targetFrame.evaluate(() => {
            const firstItem = document.querySelector('li.VLTHu.OW9LQ');
            if (firstItem) {
              const link = firstItem.querySelector('a');
              if (link) {
                const rect = link.getBoundingClientRect();
                return {
                  x: rect.left + rect.width / 2,
                  y: rect.top + rect.height / 2,
                };
              }
            }
            return null;
          });

          if (clickResult) {
            await targetFrame.click('li.VLTHu.OW9LQ a');
            await new Promise((resolve) => setTimeout(resolve, 5000));

            const allFrames = page.frames();
            const detailFrame = allFrames.find(
              (f) =>
                f.url().includes('restaurant/') && f.url().includes('/home'),
            );

            let detailData: {
              rating?: number;
              reviewCount?: number;
              blogReviewCount?: number;
            } = {};
            if (detailFrame) {
              detailData = await detailFrame.evaluate(() => {
                const data: any = {};
                const ratingText = document
                  .querySelector('span.PXMot.LXIwF')
                  ?.textContent?.trim();
                data.rating = ratingText ? parseFloat(ratingText) : 0;
                const visitorReviewEl = document.querySelector(
                  'a[href*="/review/visitor"]',
                );
                if (visitorReviewEl) {
                  const num = visitorReviewEl.textContent?.replace(
                    /[^\d]/g,
                    '',
                  );
                  data.reviewCount = num ? parseInt(num, 10) : 0;
                } else {
                  data.reviewCount = 0;
                }
                const blogReviewEl = document.querySelector(
                  'a[href*="/review/ugc"]',
                );
                if (blogReviewEl) {
                  const num = blogReviewEl.textContent?.replace(/[^\d]/g, '');
                  data.blogReviewCount = num ? parseInt(num, 10) : 0;
                } else {
                  data.blogReviewCount = 0;
                }
                return data;
              });
            }

            result.rating = detailData.rating || 0;
            result.reviewCount = detailData.reviewCount || 0;
            result.blogReviewCount = detailData.blogReviewCount || 0;

            console.log('✅ 상세 정보 추출 완료:', detailData);
          }

          return result;
        }
      }

      console.log('❌ iframe에서 음식점 정보를 찾을 수 없음');
      return null;
    } catch (error) {
      console.error(`❌ ${restaurantName} 크롤링 실패:`, error);
      return null;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
