import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RestaurantsController } from './restaurants/restaurants.controller';
import { GeminiService } from './gemini/gemini.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [RestaurantsController],
  providers: [GeminiService],
})
export class AppModule {}
