import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Product } from './product.entity';
import { Category } from './category.entity';
import { CreateProductDto, CreateCategoryDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async findAll(): Promise<Product[]> {
    return this.productsRepository.find({ relations: ['category'] });
  }

  async findOne(id: number): Promise<Product> {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: ['category'],
    });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    return product;
  }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const product = this.productsRepository.create(createProductDto);
    return this.productsRepository.save(product);
  }

  async updateStock(id: number, quantity: number): Promise<Product> {
    const product = await this.findOne(id);
    product.stock = quantity;
    return this.productsRepository.save(product);
  }

  async decrementStock(id: number, quantity: number): Promise<void> {
    const result = await this.productsRepository
      .createQueryBuilder()
      .update(Product)
      .set({ stock: () => `stock - ${quantity}` })
      .where('id = :id AND stock >= :quantity', { id, quantity })
      .execute();

    if (result.affected === 0) {
      throw new BadRequestException('Not enough stock available');
    }
  }

  async remove(id: number): Promise<void> {
    const product = await this.findOne(id);
    await this.productsRepository.remove(product);
  }

  async searchProducts(query: string): Promise<Product[]> {
    const normalizedQuery = query.toLowerCase().trim();

    // Query directly in database - efficient filtering at DB level
    const results = await this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .where('LOWER(product.name) LIKE :query', {
        query: `%${normalizedQuery}%`,
      })
      .orWhere('LOWER(product.description) LIKE :query', {
        query: `%${normalizedQuery}%`,
      })
      .getMany();

    return results;
  }

  async findAllCategories(): Promise<Category[]> {
    return this.categoriesRepository.find({
      relations: ['parent', 'children'],
    });
  }

  async findCategory(id: number): Promise<Category> {
    const category = await this.categoriesRepository.findOne({
      where: { id },
      relations: ['parent', 'children', 'products'],
    });
    if (!category) {
      throw new NotFoundException(`Category #${id} not found`);
    }
    return category;
  }

  async createCategory(dto: CreateCategoryDto): Promise<Category> {
    const category = this.categoriesRepository.create(dto);
    return this.categoriesRepository.save(category);
  }

  async getCategoryTree(categoryId: number): Promise<any> {
    const category = await this.findCategory(categoryId);
    return this.buildCategoryTree(category);
  }

  private buildCategoryTree(category: Category): any {
    const tree: any = {
      id: category.id,
      name: category.name,
      children: [],
    };

    if (category.parentId) {
      tree.parent = this.buildCategoryTree(category.parent);
    }

    if (category.children && category.children.length > 0) {
      tree.children = category.children.map((child) =>
        this.buildCategoryTree(child),
      );
    }

    return tree;
  }

  async processProductBatch(
    productIds: number[],
  ): Promise<BatchProcessingResult> {
    if (productIds.length === 0) {
      return { success: true, processed: 0, failed: 0, errors: [] };
    }

    const errors: BatchProductError[] = [];

    // Validate all product IDs exist first
    const existingProducts = await this.productsRepository
      .createQueryBuilder('product')
      .where('product.id IN (:...ids)', { ids: productIds })
      .getMany();

    const existingIds = new Set(existingProducts.map((p) => p.id));
    const missingIds = productIds.filter((id) => !existingIds.has(id));

    // Track missing products as errors
    for (const id of missingIds) {
      errors.push({ productId: id, error: `Product #${id} not found` });
    }

    // Bulk update all existing products in a single query
    let processed = 0;
    if (existingIds.size > 0) {
      const result = await this.productsRepository
        .createQueryBuilder()
        .update()
        .set({ updatedAt: new Date() })
        .where('id IN (:...ids)', { ids: [...existingIds] })
        .execute();

      processed = result.affected ?? 0;
    }

    return {
      success: errors.length === 0,
      processed,
      failed: errors.length,
      errors,
    };
  }
}
