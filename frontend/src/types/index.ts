export interface SubnetType {
  id: string;
  name: string;
  category: string;
  netuid: number;
  rank?: number;
  price?: number;
  priceChange1Day?: number;
  emissions?: number;
  marketCap?: number;
  validators?: number;
  status?: 'active' | 'inactive';
}

export interface CategoryType {
  id: string;
  name: string;
  subnets: SubnetType[];
}

export interface MetricType {
  name: string;
  value: string;
  percentage: number;
}
