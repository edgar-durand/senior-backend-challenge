interface BatchProductError {
  productId: number;
  error: string;
}

interface BatchProcessingResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: BatchProductError[];
}
