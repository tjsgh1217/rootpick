import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

export interface NaverPlaceData {
  name: string;
  rating: number;
  reviewCount: number;
  blogReviewCount: number;
  operatingHours: string;
  naverDescription: string;
}

@Injectable()
export class NaverPlaceCrawlerService {
  private browser: puppeteer.Browser | null = null;

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        protocolTimeout: 180000,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--memory-pressure-off',
          '--max_old_space_size=4096',
          '--single-process',
          '--disable-images',
        ],
      });
    }
  }

  async crawlRestaurantData(
    restaurantName: string,
  ): Promise<NaverPlaceData | null> {
    let page: puppeteer.Page | null = null;
    try {
      await this.initBrowser();
      page = await this.browser!.newPage();
      page.setDefaultNavigationTimeout(180000);
      page.setDefaultTimeout(180000);
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );
      await page.setViewport({ width: 1920, height: 1080 });
      page.on('console', () => {});

      const mapSearchUrl = `https://map.naver.com/v5/search/${encodeURIComponent(restaurantName)}`;
      await page.goto(mapSearchUrl, {
        waitUntil: 'networkidle2',
        timeout: 90000,
      });
      await new Promise((resolve) => setTimeout(resolve, 10000));

      const frames = page.frames();
      const listFrame = frames.find((f) => f.url().includes('place/list'));
      if (listFrame) {
        try {
          await listFrame.waitForSelector('li.VLTHu.OW9LQ', { timeout: 10000 });
          await listFrame.evaluate(() => {
            const firstItem = document.querySelector('li.VLTHu.OW9LQ a');
            if (firstItem) {
              (firstItem as HTMLElement).click();
              return true;
            }
            return false;
          });
          await new Promise((resolve) => setTimeout(resolve, 5000));
        } catch {}
      }

      const updatedFrames = page.frames();
      const entryFrame = updatedFrames.find(
        (f) =>
          (f.url().includes('pcmap.place.naver.com/restaurant/') ||
            f.url().includes('pcmap.place.naver.com/place/')) &&
          !f.url().includes('/list'),
      );

      if (entryFrame) {
        if (entryFrame.url().includes('/photo')) {
          const homeUrl = entryFrame.url().replace('/photo', '/home');
          try {
            await entryFrame.goto(homeUrl, {
              waitUntil: 'networkidle2',
              timeout: 10000,
            });
          } catch {
            await entryFrame.evaluate(() => {
              const tabs = document.querySelectorAll('a, button, .tab');
              for (const tab of tabs) {
                if (
                  tab.textContent?.includes('홈') ||
                  tab.textContent?.includes('정보') ||
                  (tab as HTMLElement).getAttribute('href')?.includes('/home')
                ) {
                  (tab as HTMLElement).click();
                  return;
                }
              }
            });
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        try {
          const moreInfoClicked = await entryFrame.evaluate(() => {
            const moreInfoSelectors = [
              'div.lfH3O a.fvwqf',
              'a[href*="/information"]',
              '.fvwqf',
              'a:has(.iNSaH:contains("정보"))',
              'button:contains("더보기")',
              'a:contains("더보기")',
            ];
            for (const selector of moreInfoSelectors) {
              const button = document.querySelector(selector);
              if (button) {
                const textContent = button.textContent || '';
                if (
                  textContent.includes('정보') ||
                  textContent.includes('더보기')
                ) {
                  (button as HTMLElement).click();
                  return true;
                }
              }
            }
            const allLinks = document.querySelectorAll('a');
            for (const link of allLinks) {
              const text = link.textContent || '';
              if (text.includes('정보') && text.includes('더보기')) {
                (link as HTMLElement).click();
                return true;
              }
            }
            return false;
          });
          if (moreInfoClicked) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        } catch (error) {}

        const detailData = await entryFrame.evaluate(() => {
          const data: {
            name?: string;
            rating?: number;
            operatingHours?: string;
            naverDescription?: string;
            category?: string;
            reviewCount?: number;
            blogReviewCount?: number;
          } = {};
          const nameSelectors = [
            'h1.Fc1rA',
            '.place_name',
            'h1[class*="name"]',
            '.BXtr_ h1',
            'header h1',
          ];
          for (const selector of nameSelectors) {
            const nameEl = document.querySelector(selector);
            if (nameEl && nameEl.textContent?.trim()) {
              data.name = nameEl.textContent.trim();
              break;
            }
          }
          const ratingSelectors = [
            'span.PXMot.LXIwF',
            'em.rating',
            '.rating_score',
            '.score_area em',
            '.grade_star em',
          ];
          for (const selector of ratingSelectors) {
            const ratingEl = document.querySelector(selector);
            if (ratingEl && ratingEl.textContent?.trim()) {
              const ratingText = ratingEl.textContent.trim();
              const rating = parseFloat(ratingText);
              if (!isNaN(rating) && rating > 0) {
                data.rating = rating;
                break;
              }
            }
          }
          const descriptionSelectors = [
            'div.T8RFa',
            '.place_section .description',
            '.restaurant_intro',
            '.store_intro',
            '.place_section .intro',
            '.place_section .summary',
            '.place_section p',
            '.place_detail .description',
            '.place_detail .intro',
            '.restaurant_description',
            '.store_description',
            'div[class*="description"]',
            'div[class*="intro"]',
            'div[class*="summary"]',
          ];
          for (const selector of descriptionSelectors) {
            const descEl = document.querySelector(selector);
            if (descEl && descEl.textContent?.trim()) {
              const descText = descEl.textContent.trim();
              if (descText.length > 20) {
                data.naverDescription = descText
                  .replace(/\s+/g, ' ')
                  .replace(/\n+/g, ' ')
                  .replace(/더보기|접기|펼치기/g, '')
                  .trim();
                break;
              }
            }
          }
          if (!data.naverDescription) {
            const textSelectors = [
              '.place_section_content',
              '.place_section',
              '.restaurant_info',
              '.store_info',
            ];
            for (const selector of textSelectors) {
              const sections = document.querySelectorAll(selector);
              for (const section of sections) {
                const text = section.textContent?.trim();
                if (
                  text &&
                  text.length > 50 &&
                  !text.includes('메뉴') &&
                  !text.includes('리뷰') &&
                  !text.includes('사진') &&
                  !text.includes('영업시간')
                ) {
                  data.naverDescription = text
                    .replace(/\s+/g, ' ')
                    .replace(/\n+/g, ' ')
                    .trim();
                  break;
                }
              }
              if (data.naverDescription) break;
            }
          }
          const hoursSelectors = [
            '.A_cdD',
            '.operating_hours',
            '.business_hours',
            '.time_list',
            '.hours_info',
          ];
          for (const selector of hoursSelectors) {
            const hoursEl = document.querySelector(selector);
            if (hoursEl && hoursEl.textContent?.trim()) {
              data.operatingHours = hoursEl.textContent.trim();
              break;
            }
          }
          const categorySelectors = [
            '.DJJvD',
            '.category',
            'span[class*="category"]',
            '.place_section .category',
          ];
          for (const selector of categorySelectors) {
            const categoryEl = document.querySelector(selector);
            if (categoryEl && categoryEl.textContent?.trim()) {
              data.category = categoryEl.textContent.trim();
              break;
            }
          }
          const reviewSelectors = [
            'a[href*="/review/visitor"]',
            'a[href*="/review"]',
            '.review_count',
          ];
          for (const selector of reviewSelectors) {
            const reviewEl = document.querySelector(selector);
            if (reviewEl && reviewEl.textContent) {
              const reviewText = reviewEl.textContent.replace(/[^\d]/g, '');
              if (reviewText) {
                data.reviewCount = parseInt(reviewText, 10);
                break;
              }
            }
          }
          const blogReviewEl = document.querySelector('a[href*="/review/ugc"]');
          if (blogReviewEl && blogReviewEl.textContent) {
            const blogReviewText = blogReviewEl.textContent.replace(
              /[^\d]/g,
              '',
            );
            if (blogReviewText) {
              data.blogReviewCount = parseInt(blogReviewText, 10);
            }
          }
          return data;
        });

        const result: NaverPlaceData = {
          name: detailData.name || restaurantName,
          rating: detailData.rating || 0,
          reviewCount: detailData.reviewCount || 0,
          blogReviewCount: detailData.blogReviewCount || 0,
          operatingHours: detailData.operatingHours || '',
          naverDescription: detailData.naverDescription || '',
        };
        return result;
      }
      return null;
    } catch (error) {
      return null;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  async crawlMultipleRestaurants(
    restaurantNames: string[],
    concurrency: number = 2,
  ): Promise<NaverPlaceData[]> {
    await this.initBrowser();

    const results: (NaverPlaceData | null)[] = [];

    for (let i = 0; i < restaurantNames.length; i += concurrency) {
      const batch = restaurantNames.slice(i, i + concurrency);
      const batchPromises = batch.map((name) => this.crawlRestaurantData(name));

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    await this.closeBrowser();

    return results.filter((r): r is NaverPlaceData => !!r);
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
