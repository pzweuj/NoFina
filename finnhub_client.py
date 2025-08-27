"""
Finnhub API客户端模块
用于获取股票、外汇和加密货币的实时价格数据
"""

import logging
import requests
import time
from typing import Dict, List, Any, Optional
from datetime import datetime
import json


class FinnhubClient:
    """Finnhub API客户端"""
    
    def __init__(self, config: Dict[str, Any]):
        """
        初始化Finnhub客户端
        
        Args:
            config: 配置字典
        """
        self.config = config
        self.finnhub_config = config.get('finnhub', {})
        self.api_key = self.finnhub_config.get('api_key')
        self.base_url = self.finnhub_config.get('base_url', 'https://finnhub.io/api/v1')
        self.session = requests.Session()
        self.logger = logging.getLogger(__name__)
        
        if not self.api_key:
            self.logger.error("Finnhub API密钥未配置")
            raise ValueError("Finnhub API密钥未配置")
    
    def _make_request(self, endpoint: str, params: Dict[str, Any] = None) -> Optional[Dict]:
        """
        发起API请求
        
        Args:
            endpoint: API端点
            params: 请求参数
            
        Returns:
            API响应数据
        """
        try:
            url = f"{self.base_url}/{endpoint}"
            
            # 添加API密钥
            if params is None:
                params = {}
            params['token'] = self.api_key
            
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            return response.json()
            
        except requests.exceptions.RequestException as e:
            self.logger.error(f"API请求失败: {e}")
            return None
        except json.JSONDecodeError as e:
            self.logger.error(f"JSON解析失败: {e}")
            return None
    
    def get_stock_quote(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        获取股票实时报价
        
        Args:
            symbol: 股票代码
            
        Returns:
            股票报价数据
        """
        try:
            data = self._make_request('quote', {'symbol': symbol})
            
            if data and 'c' in data:  # 'c' 是当前价格
                return {
                    'symbol': symbol,
                    'current_price': data.get('c'),  # 当前价格
                    'change': data.get('d'),         # 价格变动
                    'percent_change': data.get('dp'), # 百分比变动
                    'high': data.get('h'),           # 最高价
                    'low': data.get('l'),            # 最低价
                    'open': data.get('o'),           # 开盘价
                    'previous_close': data.get('pc'), # 前收盘价
                    'timestamp': int(time.time()),
                    'datetime': datetime.now().isoformat()
                }
            else:
                self.logger.warning(f"获取股票 {symbol} 数据失败或数据格式异常")
                return None
                
        except Exception as e:
            self.logger.error(f"获取股票 {symbol} 报价失败: {e}")
            return None
    
    def get_forex_rate(self, pair: str) -> Optional[Dict[str, Any]]:
        """
        获取外汇汇率
        
        Args:
            pair: 货币对，如 "USD/CNY"
            
        Returns:
            外汇汇率数据
        """
        try:
            # 转换货币对格式，Finnhub使用 OANDA:USD_CNY 格式
            if '/' in pair:
                base, quote = pair.split('/')
                finnhub_symbol = f"OANDA:{base}_{quote}"
            else:
                finnhub_symbol = pair
            
            data = self._make_request('quote', {'symbol': finnhub_symbol})
            
            if data and 'c' in data:
                return {
                    'pair': pair,
                    'rate': data.get('c'),           # 当前汇率
                    'change': data.get('d'),         # 汇率变动
                    'percent_change': data.get('dp'), # 百分比变动
                    'high': data.get('h'),           # 最高汇率
                    'low': data.get('l'),            # 最低汇率
                    'open': data.get('o'),           # 开盘汇率
                    'previous_close': data.get('pc'), # 前收盘汇率
                    'timestamp': int(time.time()),
                    'datetime': datetime.now().isoformat()
                }
            else:
                self.logger.warning(f"获取外汇 {pair} 数据失败或数据格式异常")
                return None
                
        except Exception as e:
            self.logger.error(f"获取外汇 {pair} 汇率失败: {e}")
            return None
    
    def get_crypto_price(self, symbol: str, exchange: str = "BINANCE") -> Optional[Dict[str, Any]]:
        """
        获取加密货币价格
        
        Args:
            symbol: 交易对，如 "BTCUSDT"
            exchange: 交易所，默认为 "BINANCE"
            
        Returns:
            加密货币价格数据
        """
        try:
            # Finnhub加密货币格式: BINANCE:BTCUSDT
            finnhub_symbol = f"{exchange}:{symbol}"
            
            data = self._make_request('quote', {'symbol': finnhub_symbol})
            
            if data and 'c' in data:
                return {
                    'symbol': symbol,
                    'exchange': exchange,
                    'price': data.get('c'),          # 当前价格
                    'change': data.get('d'),         # 价格变动
                    'percent_change': data.get('dp'), # 百分比变动
                    'high': data.get('h'),           # 最高价
                    'low': data.get('l'),            # 最低价
                    'open': data.get('o'),           # 开盘价
                    'previous_close': data.get('pc'), # 前收盘价
                    'timestamp': int(time.time()),
                    'datetime': datetime.now().isoformat()
                }
            else:
                self.logger.warning(f"获取加密货币 {symbol} 数据失败或数据格式异常")
                return None
                
        except Exception as e:
            self.logger.error(f"获取加密货币 {symbol} 价格失败: {e}")
            return None
    
    def get_multiple_stocks(self, symbols: List[str]) -> List[Dict[str, Any]]:
        """
        批量获取多个股票报价
        
        Args:
            symbols: 股票代码列表
            
        Returns:
            股票报价数据列表
        """
        results = []
        for symbol in symbols:
            quote = self.get_stock_quote(symbol)
            if quote:
                results.append(quote)
            # 添加延迟避免API限制
            time.sleep(0.1)
        
        return results
    
    def get_multiple_forex(self, pairs: List[str]) -> List[Dict[str, Any]]:
        """
        批量获取多个外汇汇率
        
        Args:
            pairs: 货币对列表
            
        Returns:
            外汇汇率数据列表
        """
        results = []
        for pair in pairs:
            rate = self.get_forex_rate(pair)
            if rate:
                results.append(rate)
            # 添加延迟避免API限制
            time.sleep(0.1)
        
        return results
    
    def get_multiple_crypto(self, crypto_list: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        """
        批量获取多个加密货币价格
        
        Args:
            crypto_list: 加密货币列表，包含symbol和exchange
            
        Returns:
            加密货币价格数据列表
        """
        results = []
        for crypto in crypto_list:
            symbol = crypto.get('symbol')
            exchange = crypto.get('exchange', 'BINANCE')
            price = self.get_crypto_price(symbol, exchange)
            if price:
                results.append(price)
            # 添加延迟避免API限制
            time.sleep(0.1)
        
        return results


if __name__ == "__main__":
    # 测试代码
    import yaml
    
    with open('config.yaml', 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    
    client = FinnhubClient(config)
    
    # 测试股票
    print("=== 股票测试 ===")
    stock_quote = client.get_stock_quote("AAPL")
    print(json.dumps(stock_quote, indent=2, ensure_ascii=False))
    
    # 测试外汇
    print("\n=== 外汇测试 ===")
    forex_rate = client.get_forex_rate("USD/CNY")
    print(json.dumps(forex_rate, indent=2, ensure_ascii=False))
    
    # 测试加密货币
    print("\n=== 加密货币测试 ===")
    crypto_price = client.get_crypto_price("BTCUSDT", "BINANCE")
    print(json.dumps(crypto_price, indent=2, ensure_ascii=False))
