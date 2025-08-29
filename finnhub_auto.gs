// 在脚本属性中存储API KEY更安全
// 1. 点击「项目设置」->「脚本属性」->「添加脚本属性」
// 2. 添加属性：FINNHUB_API_KEY，值为您的实际API Key

/**
 * 主函数：更新股票数据表
 */
function updateStockData() {
  try {
    // 获取工作表
    var sheet = getStockDataSheet();
    
    // 获取API Key（从脚本属性获取，更安全）
    var apiKey = getApiKey();
    if (!apiKey) {
      throw '请在脚本属性中设置FINNHUB_API_KEY';
    }
    
    // 获取数据范围
    var dataRange = getDataRange(sheet);
    var symbols = dataRange.symbols;
    var enabledFlags = dataRange.enabledFlags;
    var updateRange = dataRange.updateRange;
    
    // 批量获取股票数据
    var stockData = fetchBatchStockData(symbols, enabledFlags, apiKey);
    
    // 更新工作表
    updateSheetWithData(sheet, updateRange, stockData);
    
    // 添加时间戳
    addTimestamp(sheet, dataRange.timestampRange, dataRange.datetimeRange);
    
    // 提示完成
    showSuccessMessage(stockData.updatedCount);
    
  } catch (error) {
    Logger.log('Error: ' + error);
    showErrorMessage(error);
  }
}

/**
 * 获取股票数据工作表
 */
function getStockDataSheet() {
  var sheetName = 'Finnhub'; // 可根据实际表名修改
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  
  if (!sheet) {
    throw '找不到工作表: ' + sheetName;
  }
  
  return sheet;
}

/**
 * 从脚本属性获取API Key
 */
function getApiKey() {
  return PropertiesService.getScriptProperties().getProperty('FINNHUB_API_KEY');
}

/**
 * 获取数据范围
 */
function getDataRange(sheet) {
  var lastRow = sheet.getLastRow();
  
  // 假设数据从第2行开始（第1行是标题）
  if (lastRow < 2) {
    throw '没有找到股票数据';
  }
  
  // 获取Symbol列（A列）和Enabled列（I列）
  var symbolRange = sheet.getRange(2, 1, lastRow - 1, 1); // A2:A
  var enabledRange = sheet.getRange(2, 9, lastRow - 1, 1); // I2:I
  
  // 获取需要更新的数据范围（B2:H）
  var updateRange = sheet.getRange(2, 2, lastRow - 1, 7); // B2:H
  
  // 时间戳范围
  var timestampRange = sheet.getRange(2, 10, lastRow - 1, 1); // J2:J
  var datetimeRange = sheet.getRange(2, 11, lastRow - 1, 1); // K2:K
  
  return {
    symbols: symbolRange.getValues(),
    enabledFlags: enabledRange.getValues(),
    updateRange: updateRange,
    timestampRange: timestampRange,
    datetimeRange: datetimeRange
  };
}

/**
 * 批量获取股票数据
 */
function fetchBatchStockData(symbols, enabledFlags, apiKey) {
  var stockData = [];
  var updatedCount = 0;
  
  for (var i = 0; i < symbols.length; i++) {
    var symbol = symbols[i][0];
    var enabled = enabledFlags[i][0];
    
    if (!symbol || !enabled) {
      // 如果股票代码为空或未启用，添加空数据
      stockData.push(['', '', '', '', '', '', '']);
      continue;
    }
    
    try {
      var quote = getQuoteWithCache(symbol, apiKey);
      
      stockData.push([
        quote.c || '', // Price
        quote.d || '', // Change
        quote.dp || '', // Percent
        quote.h || '', // High
        quote.l || '', // Low
        quote.o || '', // Open
        quote.pc || ''  // Previous Close
      ]);
      
      updatedCount++;
      
    } catch (error) {
      Logger.log('获取股票数据失败: ' + symbol + ' - ' + error);
      stockData.push(['Error', error.toString(), '', '', '', '', '']);
    }
  }
  
  return {
    data: stockData,
    updatedCount: updatedCount
  };
}

/**
 * 带缓存的获取报价数据
 */
function getQuoteWithCache(symbol, apiKey) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'finnhub_quote_' + symbol;
  var cachedData = cache.get(cacheKey);
  
  if (cachedData) {
    return JSON.parse(cachedData);
  }
  
  var url = 'https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(symbol) + '&token=' + apiKey;
  var options = {
    'method': 'GET',
    'muteHttpExceptions': true
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var responseCode = response.getResponseCode();
  var content = response.getContentText();
  var jsonData = JSON.parse(content);
  
  if (responseCode !== 200) {
    throw 'API错误: ' + (jsonData.error || responseCode);
  }
  
  // 缓存10分钟（600秒），避免频繁调用
  cache.put(cacheKey, JSON.stringify(jsonData), 600);
  
  return jsonData;
}

/**
 * 更新工作表数据
 */
function updateSheetWithData(sheet, range, stockData) {
  range.setValues(stockData.data);
}

/**
 * 添加时间戳
 */
function addTimestamp(sheet, timestampRange, datetimeRange) {
  var now = new Date();
  var timestamps = [];
  var datetimes = [];
  
  for (var i = 0; i < timestampRange.getNumRows(); i++) {
    timestamps.push([now.getTime()]);
    datetimes.push([now.toLocaleString()]);
  }
  
  timestampRange.setValues(timestamps);
  datetimeRange.setValues(datetimes);
}

/**
 * 显示成功消息
 */
function showSuccessMessage(updatedCount) {
  var message = '股票数据更新完成！\n成功更新: ' + updatedCount + ' 支股票';
  SpreadsheetApp.getUi().alert('✅ 更新成功', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * 显示错误消息
 */
function showErrorMessage(error) {
  SpreadsheetApp.getUi().alert('❌ 更新失败', '错误信息: ' + error, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * 创建菜单
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('股票数据')
    .addItem('更新股票数据', 'updateStockData')
    .addToUi();
}

/**
 * 设置定时触发器（可选）
 * 可以设置为每10分钟或每小时自动更新
 */
function setupTrigger() {
  // 删除现有触发器
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  
  // 创建新的定时触发器（每10分钟）
  ScriptApp.newTrigger('updateStockData')
    .timeBased()
    .everyMinutes(10)
    .create();
    
  SpreadsheetApp.getUi().alert('定时器设置成功', '已设置为每10分钟自动更新数据', SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * 设置一个在北京时间周一到周六的0点到5点，21点-24点期间，每5分钟执行一次的触发器
 */
function setupTriggerBeiJing() {
  // 删除所有现有的本项目触发器（避免重复）
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }

  // 创建管理触发器的定时器，每小时检查一次
  ScriptApp.newTrigger('manageIntradaySchedule')
    .timeBased()
    .everyHours(1) // 每小时检查一次，确保及时启用/禁用
    .create();
    
  // 立即运行一次日程管理，设置初始状态
  manageIntradaySchedule();
  
  SpreadsheetApp.getUi().alert('定时器设置成功', '已设置为在北京时间周一到周六的0-5点、21-24点期间每5分钟运行。管理器每小时检查一次。', SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * 管理交易日内的触发器调度
 * 这个函数会根据北京时间启用或禁用5分钟触发器
 */
function manageIntradaySchedule() {
  var triggers = ScriptApp.getProjectTriggers();
  var fiveMinTrigger = null;
  
  // 找到5分钟触发器
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'updateStockData' && 
        triggers[i].getEventType() === ScriptApp.EventType.CLOCK) {
      fiveMinTrigger = triggers[i];
      break;
    }
  }
  
  // 获取北京时间 (UTC+8)
  var now = new Date();
  var beijingTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (8 * 3600000));
  var beijingHour = beijingTime.getHours();
  var beijingDay = beijingTime.getDay(); // 0 = 周日, 1 = 周一, ..., 6 = 周六
  
  // 检查是否在有效时间段内：周一到周六的0-5点或21-24点
  var isTradingHours = (beijingDay >= 1 && beijingDay <= 6) && // 周一到周六
                       ((beijingHour >= 0 && beijingHour < 5) || // 0-5点
                        (beijingHour >= 21 && beijingHour < 24)); // 21-24点
  
  Logger.log('当前北京时间: ' + beijingTime.toLocaleString() + 
             ', 小时: ' + beijingHour + 
             ', 星期' + beijingDay + 
             ', 是否交易时间: ' + isTradingHours +
             ', 触发器存在: ' + (fiveMinTrigger !== null));
  
  // 根据交易时间管理触发器
  if (isTradingHours && !fiveMinTrigger) {
    // 在交易时间内且没有触发器，创建新触发器
    ScriptApp.newTrigger('updateStockData')
      .timeBased()
      .everyMinutes(5)
      .create();
    Logger.log('触发器已启用 - 北京时间: ' + beijingTime.toLocaleString());
  } else if (!isTradingHours && fiveMinTrigger) {
    // 不在交易时间内且有触发器，删除触发器
    ScriptApp.deleteTrigger(fiveMinTrigger);
    Logger.log('触发器已禁用 - 北京时间: ' + beijingTime.toLocaleString());
  }
}

/**
 * 测试时区转换是否正确
 */
function testBeijingTime() {
  var now = new Date();
  var beijingTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (8 * 3600000));
  
  Logger.log('服务器时间: ' + now.toLocaleString());
  Logger.log('计算的北京时间: ' + beijingTime.toLocaleString());
  Logger.log('北京小时: ' + beijingTime.getHours());
  Logger.log('北京星期: ' + beijingTime.getDay() + ' (0=周日, 1=周一...6=周六)');
  
  // 显示给用户
  var message = '服务器时间: ' + now.toLocaleString() + '\n' +
                '计算的北京时间: ' + beijingTime.toLocaleString() + '\n' +
                '北京小时: ' + beijingTime.getHours() + '\n' +
                '北京星期: ' + beijingTime.getDay() + ' (0=周日, 1=周一...6=周六)';
  
  SpreadsheetApp.getUi().alert('时区测试', message, SpreadsheetApp.getUi().ButtonSet.OK);
}
