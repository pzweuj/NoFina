"""
免费外汇API客户端模块
支持多个免费外汇API提供商，提供备选方案
"""

import logging
import requests
import time
from typing import Dict, List, Any, Optional
from datetime import datetime
import json


class ForexClient:
    """免费外汇API客户端"""
    
    def __init__(self, config: Dict[str, Any]):
        """
        初始化外汇客户端
        
        Args:
            config: 配置字典
        """
        self.config = config
        self.forex_config = config.get('forex_apis', {})
        self.session = requests.Session()
        self.logger = logging.getLogger(__name__)
        
        # OpenExchangeRates API配置
        self.api_config = {
            'base_url': 'https://openexchangerates.org/api',
            'api_key': self.forex_config.get('open_exchange_rates', {}).get('api_key'),
            'rate_limit': 1000,  # 1000次/月
            'update_frequency': 3600  # 每小时更新一次（3600秒）
        }
    
    def _make_request(self, url: str, params: Dict[str, Any] = None, timeout: int = 30) -> Optional[Dict]:
        """
        发起HTTP请求
        
        Args:
            url: 请求URL
            params: 请求参数
            timeout: 超时时间
            
        Returns:
            API响应数据
        """
        try:
            response = self.session.get(url, params=params, timeout=timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            self.logger.error(f"HTTP请求失败: {e}")
            return None
        except json.JSONDecodeError as e:
            self.logger.error(f"JSON解析失败: {e}")
            return None
    
    
    def _get_forex_rate(self, pair: str) -> Optional[Dict[str, Any]]:
        """
        从Open Exchange Rates获取汇率
        
        Args:
            pair: 货币对，如 "USD/CNY"
            
        Returns:
            汇率数据
        """
        try:
            if not self.api_config.get('api_key'):
                self.logger.error("OpenExchangeRates API密钥未配置")
                return None
                
            if '/' not in pair:
                self.logger.error(f"无效的货币对格式: {pair}")
                return None
                
            base, target = pair.split('/')
            url = f"{self.api_config['base_url']}/latest.json"
            params = {
                'app_id': self.api_config['api_key'],
                'base': base,
                'symbols': target
            }
            
            data = self._make_request(url, params)
            
            if data and 'rates' in data and target in data['rates']:
                rate = data['rates'][target]
                return {
                    'pair': pair,
                    'rate': rate,
                    'change': 0,
                    'percent_change': 0,
                    'high': rate,
                    'low': rate,
                    'open': rate,
                    'previous_close': rate,
                    'timestamp': data.get('timestamp', int(time.time())),
                    'datetime': datetime.now().isoformat(),
                    'source': 'openexchangerates.org'
                }
            
            return None
            
        except Exception as e:
            self.logger.error(f"Open Exchange Rates API请求失败: {e}")
            return None
    
    
    def should_update_forex_rate(self, pair: str, last_update_timestamp: Optional[int] = None) -> bool:
        """
        检查是否需要更新外汇汇率（基于OpenExchangeRates的每小时更新限制）
        
        Args:
            pair: 货币对
            last_update_timestamp: 上次更新的时间戳
            
        Returns:
            是否需要更新
        """
        if last_update_timestamp is None:
            return True
        
        current_time = int(time.time())
        time_diff = current_time - last_update_timestamp
        
        # OpenExchangeRates免费版每小时更新一次
        min_update_interval = self.api_config['update_frequency']
        
        if time_diff < min_update_interval:
            remaining_time = min_update_interval - time_diff
            remaining_minutes = remaining_time // 60
            self.logger.info(f"外汇 {pair} 距离上次更新不足1小时（还需等待 {remaining_minutes} 分钟），跳过API请求")
            return False
        
        return True
    
    def get_forex_rate(self, pair: str, last_update_timestamp: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """
        获取外汇汇率（使用OpenExchangeRates API，支持时间间隔检查）
        
        Args:
            pair: 货币对，如 "USD/CNY"
            last_update_timestamp: 上次更新的时间戳
            
        Returns:
            外汇汇率数据
        """
        # 检查是否需要更新
        if not self.should_update_forex_rate(pair, last_update_timestamp):
            return None
        
        self.logger.debug(f"使用OpenExchangeRates获取 {pair} 汇率")
        result = self._get_forex_rate(pair)
        
        if result:
            self.logger.info(f"成功获取 {pair} 汇率: {result['rate']}")
            return result
        else:
            self.logger.error(f"无法获取 {pair} 汇率")
            return None
    
    def get_multiple_forex_rates(self, pairs_with_timestamps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        批量获取多个外汇汇率
        
        Args:
            pairs_with_timestamps: 包含货币对和上次更新时间的列表
                格式: [{'pair': 'USD/CNY', 'last_update': timestamp}, ...]
            
        Returns:
            外汇汇率数据列表
        """
        results = []
        for item in pairs_with_timestamps:
            pair = item.get('pair')
            last_update = item.get('last_update')
            
            rate = self.get_forex_rate(pair, last_update)
            if rate:
                results.append(rate)
            # 添加延迟避免API限制
            time.sleep(0.1)
        
        return results
    
    def test_api_connectivity(self) -> bool:
        """
        测试OpenExchangeRates API的连通性
        
        Returns:
            API连通性状态
        """
        test_pair = "USD/EUR"
        
        try:
            result = self._get_forex_rate(test_pair)
            is_connected = result is not None
            
            if is_connected:
                self.logger.info("OpenExchangeRates API连通性测试成功")
            else:
                self.logger.error("OpenExchangeRates API连通性测试失败")
                
            return is_connected
            
        except Exception as e:
            self.logger.error(f"测试OpenExchangeRates连通性失败: {e}")
            return False


if __name__ == "__main__":
    # 测试代码
    import yaml
    
    # 创建测试配置
    test_config = {
        'forex_apis': {
            'open_exchange_rates': {
                'api_key': 'YOUR_API_KEY_HERE'  # 请替换为实际的API密钥
            }
        }
    }
    
    client = ForexClient(test_config)
    
    # 测试连通性
    print("=== API连通性测试 ===")
    is_connected = client.test_api_connectivity()
    print(f"OpenExchangeRates: {'✓' if is_connected else '✗'}")
    
    # 测试获取汇率
    print("\n=== 汇率测试 ===")
    test_pairs = ["USD/CNY", "EUR/USD", "GBP/USD"]
    
    for pair in test_pairs:
        rate_data = client.get_forex_rate(pair)
        if rate_data:
            print(f"{pair}: {rate_data['rate']} (来源: {rate_data['source']})")
        else:
            print(f"{pair}: 获取失败")
