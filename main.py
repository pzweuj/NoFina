#!/usr/bin/env python3
"""
NoFina 主程序
从Notion数据库读取配置，获取Finnhub价格数据，并推送回Notion
"""

import logging
import os
import sys
import time
import json
from datetime import datetime
from typing import Dict, Any, List
import yaml

from finnhub_client import FinnhubClient
from notion_db_client import NotionClient


def setup_logging(config: Dict[str, Any]) -> None:
    """
    设置日志配置
    
    Args:
        config: 配置字典
    """
    log_config = config.get('logging', {})
    log_level = getattr(logging, log_config.get('level', 'INFO').upper())
    log_file = log_config.get('file', './logs/nofina.log')
    
    # 如果是相对路径，则相对于脚本所在目录
    if not os.path.isabs(log_file):
        script_dir = os.path.dirname(os.path.abspath(__file__))
        log_file = os.path.join(script_dir, log_file)
    
    # 创建日志目录
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    
    # 配置日志格式
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # 文件处理器
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setFormatter(formatter)
    
    # 控制台处理器
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    
    # 配置根日志器
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)


def save_data_to_file(data: List[Dict], data_type: str, config: Dict[str, Any]) -> None:
    """
    保存数据到文件
    
    Args:
        data: 数据列表
        data_type: 数据类型 (stocks, forex, crypto)
        config: 配置字典
    """
    output_config = config.get('output', {})
    
    if not output_config.get('save_to_file', False):
        return
    
    file_path = output_config.get('file_path', './data/')
    
    # 如果是相对路径，则相对于脚本所在目录
    if not os.path.isabs(file_path):
        script_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(script_dir, file_path)
    
    os.makedirs(file_path, exist_ok=True)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{data_type}_{timestamp}.json"
    full_path = os.path.join(file_path, filename)
    
    try:
        with open(full_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logging.info(f"数据已保存到文件: {full_path}")
    except Exception as e:
        logging.error(f"保存数据到文件失败: {e}")


def process_stocks(finnhub_client: FinnhubClient, notion_client: NotionClient, config: Dict[str, Any]) -> None:
    """
    处理股票数据
    
    Args:
        finnhub_client: Finnhub客户端
        notion_client: Notion客户端
        config: 配置字典
    """
    logger = logging.getLogger(__name__)
    logger.info("开始处理股票数据...")
    
    # 从Notion获取股票配置
    stock_symbols = notion_client.get_stock_symbols()
    
    if not stock_symbols:
        logger.warning("未找到启用的股票配置")
        return
    
    # 获取股票价格数据
    stock_data = []
    for symbol in stock_symbols:
        logger.info(f"获取股票 {symbol} 的价格数据...")
        quote = finnhub_client.get_stock_quote(symbol)
        
        if quote:
            stock_data.append(quote)
            # 推送到Notion价格数据库
            success = notion_client.push_stock_price(quote)
            if success:
                logger.info(f"股票 {symbol} 价格数据已推送到Notion")
            else:
                logger.error(f"股票 {symbol} 价格数据推送失败")
        else:
            logger.warning(f"未能获取股票 {symbol} 的价格数据")
        
        # 添加延迟避免API限制
        time.sleep(0.2)
    
    # 保存到文件
    save_data_to_file(stock_data, 'stocks', config)
    logger.info(f"股票数据处理完成，共处理 {len(stock_data)} 个股票")


def process_forex(finnhub_client: FinnhubClient, notion_client: NotionClient, config: Dict[str, Any]) -> None:
    """
    处理外汇数据
    
    Args:
        finnhub_client: Finnhub客户端
        notion_client: Notion客户端
        config: 配置字典
    """
    logger = logging.getLogger(__name__)
    logger.info("开始处理外汇数据...")
    
    # 从Notion获取外汇配置
    forex_pairs = notion_client.get_forex_pairs()
    
    if not forex_pairs:
        logger.warning("未找到启用的外汇配置")
        return
    
    # 获取外汇汇率数据
    forex_data = []
    for pair in forex_pairs:
        logger.info(f"获取外汇 {pair} 的汇率数据...")
        rate = finnhub_client.get_forex_rate(pair)
        
        if rate:
            forex_data.append(rate)
            # 推送到Notion价格数据库
            success = notion_client.push_forex_price(rate)
            if success:
                logger.info(f"外汇 {pair} 汇率数据已推送到Notion")
            else:
                logger.error(f"外汇 {pair} 汇率数据推送失败")
        else:
            logger.warning(f"未能获取外汇 {pair} 的汇率数据")
        
        # 添加延迟避免API限制
        time.sleep(0.2)
    
    # 保存到文件
    save_data_to_file(forex_data, 'forex', config)
    logger.info(f"外汇数据处理完成，共处理 {len(forex_data)} 个货币对")


def process_crypto(finnhub_client: FinnhubClient, notion_client: NotionClient, config: Dict[str, Any]) -> None:
    """
    处理加密货币数据
    
    Args:
        finnhub_client: Finnhub客户端
        notion_client: Notion客户端
        config: 配置字典
    """
    logger = logging.getLogger(__name__)
    logger.info("开始处理加密货币数据...")
    
    # 从Notion获取加密货币配置
    crypto_symbols = notion_client.get_crypto_symbols()
    
    if not crypto_symbols:
        logger.warning("未找到启用的加密货币配置")
        return
    
    # 获取加密货币价格数据
    crypto_data = []
    for crypto in crypto_symbols:
        symbol = crypto['symbol']
        exchange = crypto['exchange']
        logger.info(f"获取加密货币 {symbol} ({exchange}) 的价格数据...")
        
        price = finnhub_client.get_crypto_price(symbol, exchange)
        
        if price:
            crypto_data.append(price)
            # 推送到Notion价格数据库
            success = notion_client.push_crypto_price(price)
            if success:
                logger.info(f"加密货币 {symbol} 价格数据已推送到Notion")
            else:
                logger.error(f"加密货币 {symbol} 价格数据推送失败")
        else:
            logger.warning(f"未能获取加密货币 {symbol} 的价格数据")
        
        # 添加延迟避免API限制
        time.sleep(0.2)
    
    # 保存到文件
    save_data_to_file(crypto_data, 'crypto', config)
    logger.info(f"加密货币数据处理完成，共处理 {len(crypto_data)} 个交易对")


def load_config(config_path: str = 'config.yaml') -> Dict[str, Any]:
    """
    加载配置文件
    
    Args:
        config_path: 配置文件路径
        
    Returns:
        配置字典
    """
    try:
        # 如果是相对路径，则相对于脚本所在目录
        if not os.path.isabs(config_path):
            script_dir = os.path.dirname(os.path.abspath(__file__))
            config_path = os.path.join(script_dir, config_path)
        
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    except Exception as e:
        print(f"加载配置文件失败: {e}")
        sys.exit(1)


def main():
    """主函数"""
    print("NoFina 启动中...")
    
    # 加载配置
    config = load_config()
    
    # 设置日志
    setup_logging(config)
    logger = logging.getLogger(__name__)
    
    logger.info("NoFina 开始运行")
    logger.info(f"当前时间: {datetime.now().isoformat()}")
    
    try:
        # 初始化客户端
        logger.info("初始化Finnhub客户端...")
        finnhub_client = FinnhubClient(config)
        
        logger.info("初始化Notion客户端...")
        notion_client = NotionClient(config)
        
        # 处理各类数据
        process_stocks(finnhub_client, notion_client, config)
        process_forex(finnhub_client, notion_client, config)
        process_crypto(finnhub_client, notion_client, config)
        
        logger.info("NoFina 运行完成")
        
    except Exception as e:
        logger.error(f"程序运行出错: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()