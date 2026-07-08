import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * PaginationDto
 *
 * Standard query params accepted by any paginated endpoint.
 *
 * Usage in a controller:
 *   @Get()
 *   findAll(@Query() pagination: PaginationDto) { ... }
 */
export class PaginationDto {
  @ApiPropertyOptional({ example: 1, default: 1, description: 'Page number (1-based)' })
  @IsOptional()
  @Type(() => Number)          // transforms the query string to a number
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, description: 'Items per page (max 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  /** Derived offset — used by repository queries */
  get offset(): number {
    return (this.page - 1) * this.limit;
  }
}

/**
 * PaginatedResponseDto<T>
 *
 * Generic wrapper for paginated API responses.
 *
 * Consumers receive:
 *  - data:       the current page of items
 *  - total:      total number of matching records
 *  - page:       current page number
 *  - limit:      page size
 *  - totalPages: total number of pages
 *  - hasNext:    whether a next page exists
 *  - hasPrev:    whether a previous page exists
 */
export class PaginatedResponseDto<T> {
  data!: T[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
  hasNext!: boolean;
  hasPrev!: boolean;

  static of<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResponseDto<T> {
    const totalPages = Math.ceil(total / limit);
    const dto        = new PaginatedResponseDto<T>();
    dto.data         = data;
    dto.total        = total;
    dto.page         = page;
    dto.limit        = limit;
    dto.totalPages   = totalPages;
    dto.hasNext      = page < totalPages;
    dto.hasPrev      = page > 1;
    return dto;
  }
}
