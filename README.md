# NoFina - 金融数据推送到Notion

NoFina 是一个基于 Python 的金融数据采集系统，从 Finnhub API 获取实时股票、外汇和加密货币价格数据，并推送到 Notion 数据库中。个人使用向。

## 功能特性

- 🏢 **股票价格监控**: 定时获取股票报价数据
- 💱 **外汇汇率监控**: 定时获取外汇汇率数据  
- 🪙 **加密货币价格监控**: 定时获取币安等交易所的加密货币价格
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
├── notion_db_client.py          # Notion 数据库 API 客户端
├── forex_client.py              # 外汇汇率 API 客户端
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
4. Finnhub 免费版本不支持外汇数据

#### Open Exchange Rates API 密钥
1. 访问 [Open Exchange Rates](https://openexchangerates.org/)
2. 注册账户并获取免费 API 密钥
3. 免费版本每月限制 1,000 次请求
4. Open Exchange Rates 免费层级每小时更新一次
5. Open Exchange Rates 免费层级只支持以美元为基础的汇率，其他货币对采取以美元为桥梁的汇率计算方式，可能不准确

#### Notion API 密钥
1. 访问 [Notion Developers](https://developers.notion.com/)
2. 创建新的集成 (Integration)
3. 获取 Internal Integration Token
4. 将集成添加到相关的 Notion 数据库页面

### 3. 配置文件设置

编辑 `config.yaml` 文件，填入您的 API 密钥和数据库 ID（数据库 ID 从 Notion 数据库页面的 URL 中获取）：

```yaml
# Finnhub API 配置
finnhub:
  api_key: "YOUR_FINNHUB_API_KEY_HERE"

# Open Exchange Rates API 配置 (可选，用于外汇数据备用源)
openexchangerates:
  api_key: "YOUR_OPENEXCHANGERATES_API_KEY_HERE"

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

每个数据库既用于配置监控标的，也用于存储价格数据。程序会从数据库中读取启用的标的，然后将获取到的价格数据推送回同一个数据库。**可以复制下面每个数据库的条目，让Notion AI为你生成数据库。**

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

在 VPS 上使用crontab，按需设置定时任务：

```bash
# 编辑 crontab
crontab -e

# 添加以下行 (每5分钟执行一次)
*/5 * * * * python /path/to/NoFina/main.py >> /path/to/NoFina/logs/nofina_cron.log 2>&1

# **或者**在东八区美股常规交易时间每5分钟执行一次
*/5 0-5,21-23 * * 1-6 python /path/to/NoFina/main.py >> /path/to/NoFina/logs/nofina_cron.log 2>&1
```

### 调试模式

将配置文件中的日志级别设置为 `DEBUG`：

```yaml
logging:
  level: "DEBUG"
```

## Google Sheets
如果用的是Google Sheets，可以在自己的表格中新增一个名为`Finnhub`的子表，子表包含的列与上述的**股票数据库**相同，需要确保填入关注的股票/加密货币代码，勾选Enabled复选框。

然后在扩增程序 -> Apps 脚本 中设置使用 [finnhub_auto.gs](https://github.com/pzweuj/NoFina/blob/main/finnhub_auto.gs)。在编辑器中加入此脚本，然后在脚本设置中设置属性`FINNHUB_API_KEY`，填入自己的Finnhub API密钥。然后在脚本中，调用`setupTriggerBeiJing`即可实现在Finnhub表中自动更新信息（在交易时间每5分钟更新一次），比Google Sheets自带的函数更新频率更高。

注意初次使用需要在弹出的警告框中进行授权。

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 免责声明

本软件仅供学习和研究使用。使用本软件获取的金融数据不构成投资建议。请在使用前确认遵守相关 API 服务的使用条款
