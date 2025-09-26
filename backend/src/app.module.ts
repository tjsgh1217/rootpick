import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RestaurantsController } from './restaurants/restaurants.controller';
import { RestaurantService } from './services/restaurant.service';
import { NaverSearchService } from './services/naver-search.service';
import { NaverDirectionService } from './services/naver-direction.service';
import { OpenAiService } from './services/open-ai.service';
import { NaverPlaceCrawlerService } from './services/naver-place-crawler.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [RestaurantsController],
  providers: [
    RestaurantService,
    NaverSearchService,
    NaverDirectionService,
    OpenAiService,
    NaverPlaceCrawlerService,
  ],
  exports: [OpenAiService, NaverPlaceCrawlerService],
})
export class AppModule {}
