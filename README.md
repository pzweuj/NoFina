# NoFina - 金融数据采集与推送系统

NoFina 是一个基于 Python 的金融数据采集系统，从 Finnhub API 获取实时股票、外汇和加密货币价格数据，并推送到 Notion 数据库中。个人使用向。

## 功能特性

- 🏢 **股票价格监控**: 获取实时股票报价数据
- 💱 **外汇汇率监控**: 获取实时外汇汇率数据  
- 🪙 **加密货币价格监控**: 获取币安等交易所的加密货币价格
- 📊 **Notion 集成**: 从 Notion 数据库读取配置，推送价格数据
- 📝 **完整日志记录**: 详细的运行日志和错误追踪
- 💾 **数据备份**: 可选的本地文件保存功能
- ⏰ **定时任务支持**: 适合 crontab 定时执行

## 项目结构

```
NoFina/
├── example.config.yaml          # 配置文件
├── main.py                      # 主程序
├── finnhub_client.py            # Finnhub API 客户端
├── notion_client.py             # Notion API 客户端
├── requirements.txt             # Python 依赖
├── README.md                    # 项目说明
├── logs/                        # 日志目录
└── data/                        # 数据备份目录
```

## 安装与配置

### 1. 安装依赖

```bash
git clone https://github.com/pzweuj/NoFina.git
cd NoFina
pip install -r requirements.txt
cp example.config.yaml config.yaml
```

### 2. 获取 API 密钥

#### Finnhub API 密钥
1. 访问 [Finnhub.io](https://finnhub.io/)
2. 注册账户并获取免费 API 密钥
3. 免费版本每分钟限制 60 次请求

#### Notion API 密钥
1. 访问 [Notion Developers](https://developers.notion.com/)
2. 创建新的集成 (Integration)
3. 获取 Internal Integration Token
4. 将集成添加到相关的 Notion 数据库页面

### 3. 配置文件设置

编辑 `config.yaml` 文件，填入您的 API 密钥和数据库 ID：

```yaml
# Finnhub API 配置
finnhub:
  api_key: "YOUR_FINNHUB_API_KEY_HERE"

# Notion API 配置
notion:
  api_key: "YOUR_NOTION_API_KEY_HERE"
  databases:
    # 股票数据库
    stocks:
      database_id: "YOUR_STOCKS_DATABASE_ID_HERE"
      columns:
        symbol: "Symbol"      # 股票代码列名
        name: "Name"          # 股票名称列名
        enabled: "Enabled"    # 是否启用列名
        
    # 外汇数据库
    forex:
      database_id: "YOUR_FOREX_DATABASE_ID_HERE"
      columns:
        pair: "Pair"          # 货币对列名
        name: "Name"          # 货币对名称列名
        enabled: "Enabled"    # 是否启用列名
        
    # 加密货币数据库
    crypto:
      database_id: "YOUR_CRYPTO_DATABASE_ID_HERE"
      columns:
        symbol: "Symbol"      # 交易对列名
        name: "Name"          # 币种名称列名
        exchange: "Exchange"  # 交易所列名
        enabled: "Enabled"    # 是否启用列名
```

### 4. Notion 数据库结构

每个数据库既用于配置监控标的，也用于存储价格数据。程序会从数据库中读取启用的标的，然后将获取到的价格数据推送回同一个数据库。

**股票数据库**:
- `Symbol` (标题): 股票代码 (如 AAPL)
- `Name` (文本): 股票名称 (如 Apple Inc.)
- `Enabled` (复选框): 是否启用监控
- `Price` (数字): 当前价格
- `Change` (数字): 价格变动
- `Percent Change` (数字): 百分比变动
- `High` (数字): 最高价
- `Low` (数字): 最低价
- `Open` (数字): 开盘价
- `Previous Close` (数字): 前收盘价
- `Timestamp` (数字): 时间戳
- `DateTime` (文本): 日期时间

**外汇数据库**:
- `Pair` (标题): 货币对 (如 USD/CNY)
- `Name` (文本): 货币对名称
- `Enabled` (复选框): 是否启用监控
- `Rate` (数字): 汇率
- `Change` (数字): 汇率变动
- `Percent Change` (数字): 百分比变动
- `High` (数字): 最高汇率
- `Low` (数字): 最低汇率
- `Open` (数字): 开盘汇率
- `Previous Close` (数字): 前收盘汇率
- `Timestamp` (数字): 时间戳
- `DateTime` (文本): 日期时间

**加密货币数据库**:
- `Symbol` (标题): 交易对 (如 BTCUSDT)
- `Name` (文本): 币种名称
- `Exchange` (文本): 交易所 (如 BINANCE)
- `Enabled` (复选框): 是否启用监控
- `Price` (数字): 价格
- `Change` (数字): 价格变动
- `Percent Change` (数字): 百分比变动
- `High` (数字): 最高价
- `Low` (数字): 最低价
- `Open` (数字): 开盘价
- `Previous Close` (数字): 前收盘价
- `Timestamp` (数字): 时间戳
- `DateTime` (文本): 日期时间

## 使用方法

### 手动运行

```bash
python main.py
```

### 定时任务 (Crontab)

在 VPS 上设置定时任务，每 5 分钟运行一次：

```bash
# 编辑 crontab
crontab -e

# 添加以下行 (每5分钟执行一次)
*/5 * * * * python /path/to/NoFina/main.py >> /path/to/NoFina/log/nofina_cron.log 2>&1

# 或者每小时执行一次
0 * * * * python /path/to/NoFina/main.py >> /path/to/NoFina/log/nofina_cron.log 2>&1
```

### 调试模式

将配置文件中的日志级别设置为 `DEBUG`：

```yaml
logging:
  level: "DEBUG"
```

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 免责声明

本软件仅供学习和研究使用。使用本软件获取的金融数据不构成投资建议。请在使用前确认遵守相关 API 服务的使用条款
