"""
Notion数据库客户端模块
用于从Notion数据库读取配置信息，并将价格数据推送到相应的数据库
"""

import logging
from typing import List, Dict, Any, Optional
from notion_client import Client
from datetime import datetime
import yaml

class NotionClient:
    """Notion数据库客户端"""
    
    def __init__(self, config: Dict[str, Any]):
        """
        初始化Notion客户端
        
        Args:
            config: 配置字典
        """
        self.config = config
        self.notion_config = config.get('notion', {})
        self.client = Client(auth=self.notion_config.get('api_key'))
        self.logger = logging.getLogger(__name__)
        
        if not self.notion_config.get('api_key'):
            self.logger.error("Notion API密钥未配置")
            raise ValueError("Notion API密钥未配置")
    
    def query_database(self, database_id: str, filter_conditions: Optional[Dict] = None) -> List[Dict]:
        """
        查询Notion数据库
        
        Args:
            database_id: 数据库ID
            filter_conditions: 过滤条件
            
        Returns:
            查询结果列表
        """
        try:
            query_params = {"database_id": database_id}
            
            if filter_conditions:
                query_params["filter"] = filter_conditions
            
            response = self.client.databases.query(**query_params)
            return response.get('results', [])
        
        except Exception as e:
            self.logger.error(f"查询数据库失败: {e}")
            return []
    
    def extract_property_value(self, page: Dict, property_name: str) -> Optional[str]:
        """
        从页面属性中提取值
        
        Args:
            page: 页面数据
            property_name: 属性名称
            
        Returns:
            属性值
        """
        try:
            properties = page.get('properties', {})
            prop = properties.get(property_name, {})
            prop_type = prop.get('type')
            
            if prop_type == 'title':
                title_list = prop.get('title', [])
                return title_list[0].get('text', {}).get('content', '') if title_list else ''
            
            elif prop_type == 'rich_text':
                rich_text_list = prop.get('rich_text', [])
                return rich_text_list[0].get('text', {}).get('content', '') if rich_text_list else ''
            
            elif prop_type == 'select':
                select_obj = prop.get('select')
                return select_obj.get('name', '') if select_obj else ''
            
            elif prop_type == 'checkbox':
                return prop.get('checkbox', False)
            
            elif prop_type == 'number':
                return prop.get('number')
            
            else:
                self.logger.warning(f"不支持的属性类型: {prop_type}")
                return None
                
        except Exception as e:
            self.logger.error(f"提取属性值失败: {e}")
            return None
    
    def get_stock_symbols(self) -> List[str]:
        """
        从Notion配置数据库获取股票代码列表
        
        Returns:
            股票代码列表
        """
        try:
            db_config = self.notion_config.get('databases', {}).get('stocks', {})
            database_id = db_config.get('database_id')
            columns = db_config.get('columns', {})
            
            if not database_id:
                self.logger.warning("未配置股票配置数据库ID")
                return []
            
            # 查询启用的股票
            filter_conditions = {
                "property": columns.get('enabled', 'Enabled'),
                "checkbox": {
                    "equals": True
                }
            }
            
            pages = self.query_database(database_id, filter_conditions)
            symbols = []
            
            for page in pages:
                symbol = self.extract_property_value(page, columns.get('symbol', 'Symbol'))
                if symbol:
                    symbols.append(symbol.upper())
            
            self.logger.info(f"从Notion获取到 {len(symbols)} 个股票代码")
            return symbols
            
        except Exception as e:
            self.logger.error(f"获取股票代码失败: {e}")
            return []
    
    def get_forex_pairs(self) -> List[str]:
        """
        从Notion配置数据库获取外汇货币对列表
        
        Returns:
            外汇货币对列表
        """
        try:
            db_config = self.notion_config.get('databases', {}).get('forex', {})
            database_id = db_config.get('database_id')
            columns = db_config.get('columns', {})
            
            if not database_id:
                self.logger.warning("未配置外汇配置数据库ID")
                return []
            
            # 查询启用的货币对
            filter_conditions = {
                "property": columns.get('enabled', 'Enabled'),
                "checkbox": {
                    "equals": True
                }
            }
            
            pages = self.query_database(database_id, filter_conditions)
            pairs = []
            
            for page in pages:
                pair = self.extract_property_value(page, columns.get('pair', 'Pair'))
                if pair:
                    pairs.append(pair.upper())
            
            self.logger.info(f"从Notion获取到 {len(pairs)} 个外汇货币对")
            return pairs
            
        except Exception as e:
            self.logger.error(f"获取外汇货币对失败: {e}")
            return []
    
    def get_forex_pairs_with_timestamps(self) -> List[Dict[str, Any]]:
        """
        从Notion数据库获取外汇货币对及其上次更新时间
        
        Returns:
            包含货币对和上次更新时间戳的列表
        """
        try:
            db_config = self.notion_config.get('databases', {}).get('forex', {})
            database_id = db_config.get('database_id')
            columns = db_config.get('columns', {})
            
            if not database_id:
                self.logger.warning("未配置外汇配置数据库ID")
                return []
            
            # 查询启用的货币对
            filter_conditions = {
                "property": columns.get('enabled', 'Enabled'),
                "checkbox": {
                    "equals": True
                }
            }
            
            pages = self.query_database(database_id, filter_conditions)
            pairs_with_timestamps = []
            
            for page in pages:
                pair = self.extract_property_value(page, columns.get('pair', 'Pair'))
                if pair:
                    # 获取上次更新时间戳
                    last_update = self.extract_property_value(page, 'Timestamp')
                    if last_update is None:
                        last_update = 0  # 如果没有时间戳，设为0表示需要更新
                    
                    pairs_with_timestamps.append({
                        'pair': pair.upper(),
                        'last_update': int(last_update) if last_update else 0
                    })
            
            self.logger.info(f"从Notion获取到 {len(pairs_with_timestamps)} 个外汇货币对及时间戳")
            return pairs_with_timestamps
            
        except Exception as e:
            self.logger.error(f"获取外汇货币对及时间戳失败: {e}")
            return []
    
    def get_crypto_symbols(self) -> List[Dict[str, str]]:
        """
        从Notion配置数据库获取加密货币交易对列表
        
        Returns:
            加密货币交易对列表，包含symbol和exchange信息
        """
        try:
            db_config = self.notion_config.get('databases', {}).get('crypto', {})
            database_id = db_config.get('database_id')
            columns = db_config.get('columns', {})
            
            if not database_id:
                self.logger.warning("未配置加密货币配置数据库ID")
                return []
            
            # 查询启用的加密货币
            filter_conditions = {
                "property": columns.get('enabled', 'Enabled'),
                "checkbox": {
                    "equals": True
                }
            }
            
            pages = self.query_database(database_id, filter_conditions)
            crypto_list = []
            
            for page in pages:
                symbol = self.extract_property_value(page, columns.get('symbol', 'Symbol'))
                exchange = self.extract_property_value(page, columns.get('exchange', 'Exchange'))
                
                if symbol:
                    crypto_list.append({
                        'symbol': symbol.upper(),
                        'exchange': exchange.upper() if exchange else 'BINANCE'
                    })
            
            self.logger.info(f"从Notion获取到 {len(crypto_list)} 个加密货币交易对")
            return crypto_list
            
        except Exception as e:
            self.logger.error(f"获取加密货币交易对失败: {e}")
            return []
    
    def find_existing_page(self, database_id: str, identifier_property: str, identifier_value: str) -> Optional[Dict[str, Any]]:
        """
        查找数据库中是否存在指定标识符的页面
        
        Args:
            database_id: 数据库ID
            identifier_property: 标识符属性名
            identifier_value: 标识符值
            
        Returns:
            页面信息（如果存在），包含id和properties，否则返回None
        """
        try:
            filter_conditions = {
                "property": identifier_property,
                "title": {
                    "equals": identifier_value
                }
            }
            
            pages = self.query_database(database_id, filter_conditions)
            return pages[0] if pages else None
            
        except Exception as e:
            self.logger.error(f"查找现有页面失败: {e}")
            return None
    
    def update_page(self, page_id: str, properties: Dict[str, Any]) -> bool:
        """
        更新页面属性
        
        Args:
            page_id: 页面ID
            properties: 要更新的属性
            
        Returns:
            是否更新成功
        """
        try:
            self.client.pages.update(
                page_id=page_id,
                properties=properties
            )
            return True
        except Exception as e:
            self.logger.error(f"更新页面失败: {e}")
            return False
    
    def create_price_page(self, database_id: str, properties: Dict[str, Any]) -> bool:
        """
        在价格数据库中创建页面
        
        Args:
            database_id: 数据库ID
            properties: 页面属性
            
        Returns:
            是否创建成功
        """
        try:
            response = self.client.pages.create(
                parent={"database_id": database_id},
                properties=properties
            )
            return True
        except Exception as e:
            self.logger.error(f"创建价格页面失败: {e}")
            return False
    
    def upsert_price_page(self, database_id: str, identifier_property: str, identifier_value: str, properties: Dict[str, Any]) -> bool:
        """
        更新或插入价格页面（如果存在则更新，否则创建新页面）
        
        Args:
            database_id: 数据库ID
            identifier_property: 标识符属性名
            identifier_value: 标识符值
            properties: 页面属性
            
        Returns:
            是否操作成功
        """
        try:
            # 查找现有页面
            existing_page = self.find_existing_page(database_id, identifier_property, identifier_value)
            
            if existing_page:
                # 更新现有页面（排除标识符属性，避免重复设置）
                update_properties = {k: v for k, v in properties.items() if k != identifier_property}
                success = self.update_page(existing_page['id'], update_properties)
                if success:
                    self.logger.debug(f"已更新现有页面: {identifier_value}")
                return success
            else:
                # 创建新页面
                success = self.create_price_page(database_id, properties)
                if success:
                    self.logger.debug(f"已创建新页面: {identifier_value}")
                return success
                
        except Exception as e:
            self.logger.error(f"更新或插入价格页面失败: {e}")
            return False
    
    def push_stock_price(self, stock_data: Dict[str, Any]) -> bool:
        """
        推送股票价格数据到价格数据库
        
        Args:
            stock_data: 股票价格数据
            
        Returns:
            是否推送成功
        """
        try:
            # 使用股票配置数据库作为价格数据库
            price_db_id = self.notion_config.get('databases', {}).get('stocks', {}).get('database_id')
            if not price_db_id:
                self.logger.error("未配置股票数据库ID")
                return False
            
            symbol = stock_data.get('symbol', '')
            properties = {
                "Symbol": {
                    "title": [{"text": {"content": symbol}}]
                },
                "Price": {
                    "number": stock_data.get('current_price', 0)
                },
                "Change": {
                    "number": stock_data.get('change', 0)
                },
                "Percent Change": {
                    "number": stock_data.get('percent_change', 0)
                },
                "High": {
                    "number": stock_data.get('high', 0)
                },
                "Low": {
                    "number": stock_data.get('low', 0)
                },
                "Open": {
                    "number": stock_data.get('open', 0)
                },
                "Previous Close": {
                    "number": stock_data.get('previous_close', 0)
                },
                "Timestamp": {
                    "number": stock_data.get('timestamp', 0)
                },
                "DateTime": {
                    "rich_text": [{"text": {"content": stock_data.get('datetime', '')}}]
                }
            }
            
            return self.upsert_price_page(price_db_id, "Symbol", symbol, properties)
            
        except Exception as e:
            self.logger.error(f"推送股票价格失败: {e}")
            return False
    
    def push_forex_price(self, forex_data: Dict[str, Any]) -> bool:
        """
        推送外汇价格数据到价格数据库
        
        Args:
            forex_data: 外汇价格数据
            
        Returns:
            是否推送成功
        """
        try:
            # 使用外汇配置数据库作为价格数据库
            price_db_id = self.notion_config.get('databases', {}).get('forex', {}).get('database_id')
            if not price_db_id:
                self.logger.error("未配置外汇数据库ID")
                return False
            
            pair = forex_data.get('pair', '')
            properties = {
                "Pair": {
                    "title": [{"text": {"content": pair}}]
                },
                "Rate": {
                    "number": forex_data.get('rate', 0)
                },
                "Change": {
                    "number": forex_data.get('change', 0)
                },
                "Percent Change": {
                    "number": forex_data.get('percent_change', 0)
                },
                "High": {
                    "number": forex_data.get('high', 0)
                },
                "Low": {
                    "number": forex_data.get('low', 0)
                },
                "Open": {
                    "number": forex_data.get('open', 0)
                },
                "Previous Close": {
                    "number": forex_data.get('previous_close', 0)
                },
                "Timestamp": {
                    "number": forex_data.get('timestamp', 0)
                },
                "DateTime": {
                    "rich_text": [{"text": {"content": forex_data.get('datetime', '')}}]
                }
            }
            
            return self.upsert_price_page(price_db_id, "Pair", pair, properties)
            
        except Exception as e:
            self.logger.error(f"推送外汇价格失败: {e}")
            return False
    
    def push_crypto_price(self, crypto_data: Dict[str, Any]) -> bool:
        """
        推送加密货币价格数据到价格数据库
        
        Args:
            crypto_data: 加密货币价格数据
            
        Returns:
            是否推送成功
        """
        try:
            # 使用加密货币配置数据库作为价格数据库
            price_db_id = self.notion_config.get('databases', {}).get('crypto', {}).get('database_id')
            if not price_db_id:
                self.logger.error("未配置加密货币数据库ID")
                return False
            
            symbol = crypto_data.get('symbol', '')
            properties = {
                "Symbol": {
                    "title": [{"text": {"content": symbol}}]
                },
                "Exchange": {
                    "rich_text": [{"text": {"content": crypto_data.get('exchange', '')}}]
                },
                "Price": {
                    "number": crypto_data.get('price', 0)
                },
                "Change": {
                    "number": crypto_data.get('change', 0)
                },
                "Percent Change": {
                    "number": crypto_data.get('percent_change', 0)
                },
                "High": {
                    "number": crypto_data.get('high', 0)
                },
                "Low": {
                    "number": crypto_data.get('low', 0)
                },
                "Open": {
                    "number": crypto_data.get('open', 0)
                },
                "Previous Close": {
                    "number": crypto_data.get('previous_close', 0)
                },
                "Timestamp": {
                    "number": crypto_data.get('timestamp', 0)
                },
                "DateTime": {
                    "rich_text": [{"text": {"content": crypto_data.get('datetime', '')}}]
                }
            }
            
            return self.upsert_price_page(price_db_id, "Symbol", symbol, properties)
            
        except Exception as e:
            self.logger.error(f"推送加密货币价格失败: {e}")
            return False


def load_config(config_path: str = 'config.yaml') -> Dict[str, Any]:
    """
    加载配置文件
    
    Args:
        config_path: 配置文件路径
        
    Returns:
        配置字典
    """
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    except Exception as e:
        logging.error(f"加载配置文件失败: {e}")
        return {}


if __name__ == "__main__":
    # 测试代码
    config = load_config()
    notion_client = NotionClient(config)
    
    print("股票代码:", notion_client.get_stock_symbols())
    print("外汇货币对:", notion_client.get_forex_pairs())
    print("加密货币交易对:", notion_client.get_crypto_symbols())
