/**
 * Status Monitor 脚本
 * 监控 StockSummary 和 CryptoSummary 工作表中"简要决策"列的变化
 * 每5分钟检查一次，如果发现变化则记录并通知
 */

// 配置常量
const MONITORED_SHEETS = [
  {
    name: 'StockSummary',
    displayName: '股票',
    propertyKey: 'STOCK_SUMMARY_PREVIOUS_DATA'
  },
  {
    name: 'CryptoSummary', 
    displayName: '加密货币',
    propertyKey: 'CRYPTO_SUMMARY_PREVIOUS_DATA'
  }
];

const HEADER_ROW = 8; // 标题行
const CODE_COLUMN = 1; // 代码列 (A列)
const NAME_COLUMN = 2; // 名称列 (B列)
const DECISION_COLUMN = 6; // 简要决策列 (F列)

/**
 * 主监控函数 - 监控所有配置的工作表
 */
function monitorStatusChanges() {
  try {
    const beijingTime = getBeijingTime();
    const timeString = formatBeijingTime(beijingTime);
    Logger.log(`开始监控状态变化... 检测时间: ${timeString}`);
    
    // 更新最后检测时间
    updateLastCheckTime(timeString);
    
    let totalChanges = 0;
    const allChanges = [];
    
    // 遍历所有需要监控的工作表
    for (const sheetConfig of MONITORED_SHEETS) {
      try {
        Logger.log(`监控 ${sheetConfig.displayName} (${sheetConfig.name})...`);
        
        // 获取工作表
        const sheet = getSheet(sheetConfig.name);
        if (!sheet) {
          Logger.log(`警告: 找不到工作表 ${sheetConfig.name}，跳过监控`);
          continue;
        }
        
        // 1. 获取当前简要策略作为"新决策"
        const newDecisions = getCurrentData(sheet, sheetConfig.name);
        Logger.log(`获取到 ${newDecisions.length} 条新决策数据`);
        
        // 2. 获取上次保存的"原决策"
        const originalDecisions = getPreviousData(sheetConfig.propertyKey);
        Logger.log(`获取到 ${originalDecisions.length} 条原决策数据`);
        
        // 3. 对比新决策和原决策，检测差异
        const changes = detectChanges(originalDecisions, newDecisions, sheetConfig);
        Logger.log(`检测到 ${changes.length} 个决策变化`);
        
        // 4. 如果有差异，收集变化信息用于推送
        if (changes.length > 0) {
          allChanges.push(...changes);
          totalChanges += changes.length;
        }
        
        // 5. 将新决策替换为原决策，等待下一个5分钟执行
        saveOriginalDecisions(sheetConfig.propertyKey, newDecisions);
        Logger.log(`已将新决策保存为原决策，等待下次检测`);
        
        Logger.log(`${sheetConfig.displayName}监控完成，检测到 ${changes.length} 个变化`);
        
      } catch (error) {
        Logger.log(`监控 ${sheetConfig.name} 时出错: ${error.toString()}`);
      }
    }
    
    // 6. 如果有差异，统一处理并推送通知
    if (allChanges.length > 0) {
      handleChanges(allChanges);
      Logger.log(`已推送 ${totalChanges} 个决策变化通知`);
    }
    
    Logger.log(`总监控完成，检测到 ${totalChanges} 个变化，检测时间: ${timeString}`);
    
  } catch (error) {
    Logger.log('监控过程中发生错误: ' + error.toString());
    notifyError(error);
  }
}

/**
 * 获取指定名称的工作表
 */
function getSheet(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(sheetName);
}

/**
 * 获取当前数据
 */
function getCurrentData(sheet, sheetName) {
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= HEADER_ROW) {
    Logger.log('没有找到数据行');
    return [];
  }
  
  // 获取数据范围：从标题行下一行开始到最后一行
  const dataRange = sheet.getRange(HEADER_ROW + 1, 1, lastRow - HEADER_ROW, DECISION_COLUMN);
  const values = dataRange.getValues();
  
  const data = [];
  const seenCodes = new Set(); // 用于检测重复代码
  
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const code = row[CODE_COLUMN - 1]; // 代码
    const name = row[NAME_COLUMN - 1]; // 名称
    const decision = row[DECISION_COLUMN - 1]; // 简要决策
    
    // 只处理有代码的行
    if (code && code.toString().trim() !== '') {
      const trimmedCode = code.toString().trim();
      const uniqueKey = `${sheetName}_${trimmedCode}`; // 使用工作表名+代码作为唯一键
      
      // 检查是否有重复代码
      if (seenCodes.has(trimmedCode)) {
        Logger.log(`警告: 在 ${sheetName} 中发现重复代码 ${trimmedCode}，行号 ${HEADER_ROW + 1 + i}`);
      }
      seenCodes.add(trimmedCode);
      
      data.push({
        rowIndex: HEADER_ROW + 1 + i, // 实际行号
        code: trimmedCode,
        name: name ? name.toString().trim() : '',
        decision: decision ? decision.toString().trim() : '',
        uniqueKey: uniqueKey // 添加唯一键
      });
    }
  }
  
  return data;
}

/**
 * 获取上次保存的数据
 */
function getPreviousData(propertyKey) {
  try {
    const properties = PropertiesService.getScriptProperties();
    const previousDataJson = properties.getProperty(propertyKey);
    
    Logger.log(`尝试获取原决策数据，propertyKey: ${propertyKey}`);
    
    if (previousDataJson) {
      const data = JSON.parse(previousDataJson);
      Logger.log(`成功获取到 ${data.length} 条原决策数据`);
      return data;
    } else {
      Logger.log(`未找到原决策数据 (${propertyKey})，返回空数组`);
    }
  } catch (error) {
    Logger.log(`获取上次数据时出错 (${propertyKey}): ${error.toString()}`);
  }
  
  return [];
}

/**
 * 保存原决策数据
 */
function saveOriginalDecisions(propertyKey, newDecisions) {
  try {
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty(propertyKey, JSON.stringify(newDecisions));
    Logger.log(`已保存 ${newDecisions.length} 条原决策数据 (${propertyKey})`);
  } catch (error) {
    Logger.log(`保存原决策数据时出错 (${propertyKey}): ${error.toString()}`);
  }
}

/**
 * 更新最后检测时间
 */
function updateLastCheckTime(timeString) {
  try {
    const properties = PropertiesService.getScriptProperties();
    properties.setProperty('LAST_CHECK_TIME', timeString);
    Logger.log(`更新最后检测时间: ${timeString}`);
  } catch (error) {
    Logger.log(`更新检测时间时出错: ${error.toString()}`);
  }
}

/**
 * 检测变化
 */
function detectChanges(previousData, currentData, sheetConfig) {
  const changes = [];
  
  // 创建上次数据的映射，以唯一键为键（如果没有uniqueKey则使用code）
  const previousMap = {};
  previousData.forEach(item => {
    const key = item.uniqueKey || item.code;
    previousMap[key] = item;
  });
  
  // 检查当前数据中的每一项
  currentData.forEach(currentItem => {
    const key = currentItem.uniqueKey || currentItem.code;
    const previousItem = previousMap[key];
    
    if (previousItem) {
      // 如果简要决策发生了变化
      if (previousItem.decision !== currentItem.decision) {
        changes.push({
          sheetName: sheetConfig.name,
          sheetDisplayName: sheetConfig.displayName,
          code: currentItem.code,
          name: currentItem.name,
          previousDecision: previousItem.decision,
          currentDecision: currentItem.decision,
          rowIndex: currentItem.rowIndex,
          uniqueKey: currentItem.uniqueKey
        });
      }
    } else {
      // 新增的项目（如果有简要决策）
      if (currentItem.decision && currentItem.decision !== '') {
        changes.push({
          sheetName: sheetConfig.name,
          sheetDisplayName: sheetConfig.displayName,
          code: currentItem.code,
          name: currentItem.name,
          previousDecision: '',
          currentDecision: currentItem.decision,
          rowIndex: currentItem.rowIndex,
          uniqueKey: currentItem.uniqueKey,
          isNew: true
        });
      }
    }
  });
  
  return changes;
}

/**
 * 处理变化
 */
function handleChanges(changes) {
  const changeMessages = [];
  const beijingTime = getBeijingTime();
  const timeString = formatBeijingTime(beijingTime);
  
  // 按工作表分组变化
  const changesBySheet = {};
  changes.forEach(change => {
    if (!changesBySheet[change.sheetDisplayName]) {
      changesBySheet[change.sheetDisplayName] = [];
    }
    changesBySheet[change.sheetDisplayName].push(change);
  });
  
  // 生成变化消息
  Object.keys(changesBySheet).forEach(sheetDisplayName => {
    const sheetChanges = changesBySheet[sheetDisplayName];
    changeMessages.push(`\n【${sheetDisplayName}】:`);
    
    sheetChanges.forEach(change => {
      let message;
      if (change.isNew) {
        message = `[${change.code}]-[${change.name}]-[新增]->[${change.currentDecision}]`;
      } else {
        message = `[${change.code}]-[${change.name}]-[${change.previousDecision}]->[${change.currentDecision}]`;
      }
      changeMessages.push(message);
      
      // 记录到日志
      Logger.log(`${timeString} - ${change.sheetDisplayName}变化: ${message}`);
    });
  });
  
  // 发送通知
  notifyChanges(changeMessages, timeString, changes.length);
  
  // 记录变化到工作表
  recordChangesToSheet(changes, timeString);
}

/**
 * 发送变化通知
 */
function notifyChanges(changeMessages, timeString, totalCount) {
  try {
    // 仅使用企业微信通知
    sendWeChatWorkNotification(changeMessages, timeString, totalCount);
    
  } catch (error) {
    Logger.log('发送通知时出错: ' + error.toString());
  }
}

/**
 * 将变化记录到专门的工作表中
 */
function recordChangesToSheet(changes, timeString) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = spreadsheet.getSheetByName('状态变化记录');
    
    // 如果记录表不存在，创建它
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet('状态变化记录');
      // 添加标题行
      logSheet.getRange(1, 1, 1, 7).setValues([
        ['时间', '类型', '代码', '名称', '原决策', '新决策', '行号']
      ]);
      logSheet.getRange(1, 1, 1, 7).setFontWeight('bold');
    }
    
    // 添加变化记录
    const lastRow = logSheet.getLastRow();
    const newData = changes.map(change => [
      timeString,
      change.sheetDisplayName,
      change.code,
      change.name,
      change.previousDecision,
      change.currentDecision,
      change.rowIndex
    ]);
    
    if (newData.length > 0) {
      logSheet.getRange(lastRow + 1, 1, newData.length, 7).setValues(newData);
    }
    
  } catch (error) {
    Logger.log('记录变化到工作表时出错: ' + error.toString());
  }
}

/**
 * 发送企业微信通知
 */
function sendWeChatWorkNotification(changeMessages, timeString, totalCount) {
  try {
    // 从环境变量获取企业微信 webhook key
    const properties = PropertiesService.getScriptProperties();
    const webhookKey = properties.getProperty('WECHAT_WEBHOOK_KEY');
    
    if (!webhookKey) {
      Logger.log('未配置企业微信 webhook key，跳过企业微信通知');
      return;
    }
    
    // 构建通知消息
    const title = `📊 NoFina 状态变化通知`;
    const summary = `检测到 ${totalCount} 个简要决策变化`;
    const content = `${title}\n\n${summary}:\n${changeMessages.join('\n')}\n\n⏰ 检测时间: ${timeString}`;
    
    // 构建请求数据
    const payload = {
      "msgtype": "text",
      "text": {
        "content": content
      }
    };
    
    // 发送 webhook 请求
    const webhookUrl = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${webhookKey}`;
    const options = {
      'method': 'POST',
      'headers': {
        'Content-Type': 'application/json'
      },
      'payload': JSON.stringify(payload)
    };
    
    const response = UrlFetchApp.fetch(webhookUrl, options);
    const responseData = JSON.parse(response.getContentText());
    
    if (responseData.errcode === 0) {
      Logger.log('企业微信通知发送成功');
    } else {
      Logger.log(`企业微信通知发送失败: ${responseData.errmsg} (错误码: ${responseData.errcode})`);
    }
    
  } catch (error) {
    Logger.log('发送企业微信通知时出错: ' + error.toString());
  }
}

/**
 * 发送邮件通知（可选功能）
 */
function sendEmailNotification(changeMessages, timeString, totalCount) {
  try {
    // 获取当前用户邮箱
    const email = Session.getActiveUser().getEmail();
    
    if (email) {
      const subject = `状态变化通知 - ${timeString}`;
      const body = `检测到 ${totalCount} 个简要决策变化:` + 
                   changeMessages.join('\n') + 
                   `\n\n检测时间: ${timeString}` +
                   `\n\n此邮件由 Google Apps Script 自动发送。`;
      
      MailApp.sendEmail(email, subject, body);
      Logger.log('邮件通知已发送到: ' + email);
    }
  } catch (error) {
    Logger.log('发送邮件通知时出错: ' + error.toString());
  }
}

/**
 * 错误通知
 */
function notifyError(error) {
  try {
    const timeString = formatBeijingTime(getBeijingTime());
    const message = `❌ NoFina 状态监控出错:\n\n${error.toString()}\n\n⏰ 时间: ${timeString}`;
    
    // 记录到日志
    Logger.log('错误通知: ' + message);
    
    // 仅使用企业微信错误通知
    sendWeChatWorkErrorNotification(message);
    
  } catch (e) {
    Logger.log('发送错误通知时出错: ' + e.toString());
  }
}

/**
 * 发送企业微信错误通知
 */
function sendWeChatWorkErrorNotification(message) {
  try {
    const properties = PropertiesService.getScriptProperties();
    const webhookKey = properties.getProperty('WECHAT_WEBHOOK_KEY');
    
    if (!webhookKey) {
      Logger.log('未配置企业微信 webhook key，跳过企业微信错误通知');
      return;
    }
    
    const payload = {
      "msgtype": "text",
      "text": {
        "content": message
      }
    };
    
    const webhookUrl = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${webhookKey}`;
    const options = {
      'method': 'POST',
      'headers': {
        'Content-Type': 'application/json'
      },
      'payload': JSON.stringify(payload)
    };
    
    const response = UrlFetchApp.fetch(webhookUrl, options);
    const responseData = JSON.parse(response.getContentText());
    
    if (responseData.errcode === 0) {
      Logger.log('企业微信错误通知发送成功');
    } else {
      Logger.log(`企业微信错误通知发送失败: ${responseData.errmsg} (错误码: ${responseData.errcode})`);
    }
    
  } catch (error) {
    Logger.log('发送企业微信错误通知时出错: ' + error.toString());
  }
}

/**
 * 设置5分钟监控触发器
 */
function setupMonitoringTrigger() {
  try {
    // 删除现有的监控触发器
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'monitorStatusChanges') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    // 创建新的5分钟触发器
    ScriptApp.newTrigger('monitorStatusChanges')
      .timeBased()
      .everyMinutes(5)
      .create();
    
    const sheetNames = MONITORED_SHEETS.map(sheet => sheet.displayName).join('、');
    const message = '✅ 状态监控触发器设置成功！\n\n' +
                   `• 监控对象: ${sheetNames}\n` +
                   '• 监控频率: 每5分钟\n' +
                   '• 监控列: "简要决策"列\n' +
                   '• 变化格式: [代码]-[名称]-[状态1]->[状态2]\n' +
                   '• 记录位置: "状态变化记录"工作表\n\n' +
                   '监控已开始运行...';
    
    SpreadsheetApp.getUi().alert('监控设置完成', message, SpreadsheetApp.getUi().ButtonSet.OK);
    
    // 立即运行一次以初始化数据
    monitorStatusChanges();
    
  } catch (error) {
    const errorMessage = '❌ 设置监控触发器时出错:\n\n' + error.toString();
    SpreadsheetApp.getUi().alert('设置失败', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    Logger.log('设置触发器错误: ' + error.toString());
  }
}

/**
 * 设置每日健康检查触发器 - 每天晚上9:30
 */
function setupDailyHealthCheckTrigger() {
  try {
    // 删除现有的健康检查触发器
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'sendDailyHealthCheck') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    
    // 创建每日9:30PM触发器（北京时间）
    // Google Apps Script使用UTC时间，北京时间21:30 = UTC 13:30
    // 但是要注意：北京时间比UTC快8小时，所以北京时间21:30 = UTC 13:30
    ScriptApp.newTrigger('sendDailyHealthCheck')
      .timeBased()
      .everyDays(1)
      .atHour(13) // UTC 13:30 = 北京时间 21:30
      .nearMinute(30) // 30分钟
      .create();
    
    const message = '✅ 每日健康检查触发器设置成功！\n\n' +
                   '• 通知时间: 每天晚上9:30 (北京时间)\n' +
                   '• 通知内容: "🧪 NoFina 监控系统正常"\n' +
                   '• 通知方式: 企业微信\n\n' +
                   '每日健康检查已开始运行...';
    
    SpreadsheetApp.getUi().alert('健康检查设置完成', message, SpreadsheetApp.getUi().ButtonSet.OK);
    
  } catch (error) {
    const errorMessage = '❌ 设置每日健康检查触发器时出错:\n\n' + error.toString();
    SpreadsheetApp.getUi().alert('设置失败', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    Logger.log('设置每日健康检查触发器错误: ' + error.toString());
  }
}

/**
 * 停止监控
 */
function stopMonitoring() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let deletedCount = 0;
    
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'monitorStatusChanges') {
        ScriptApp.deleteTrigger(trigger);
        deletedCount++;
      }
    });
    
    const message = deletedCount > 0 ? 
                   `✅ 已停止状态监控\n删除了 ${deletedCount} 个触发器` :
                   '⚠️ 没有找到运行中的监控触发器';
    
    SpreadsheetApp.getUi().alert('停止监控', message, SpreadsheetApp.getUi().ButtonSet.OK);
    
  } catch (error) {
    const errorMessage = '❌ 停止监控时出错:\n\n' + error.toString();
    SpreadsheetApp.getUi().alert('操作失败', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    Logger.log('停止监控错误: ' + error.toString());
  }
}

/**
 * 停止每日健康检查
 */
function stopDailyHealthCheck() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let deletedCount = 0;
    
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'sendDailyHealthCheck') {
        ScriptApp.deleteTrigger(trigger);
        deletedCount++;
      }
    });
    
    const message = deletedCount > 0 ? 
                   `✅ 已停止每日健康检查\n删除了 ${deletedCount} 个触发器` :
                   '⚠️ 没有找到运行中的健康检查触发器';
    
    SpreadsheetApp.getUi().alert('停止健康检查', message, SpreadsheetApp.getUi().ButtonSet.OK);
    
  } catch (error) {
    const errorMessage = '❌ 停止每日健康检查时出错:\n\n' + error.toString();
    SpreadsheetApp.getUi().alert('操作失败', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    Logger.log('停止每日健康检查错误: ' + error.toString());
  }
}

/**
 * 手动检查一次变化（用于测试）
 */
function checkChangesOnce() {
  try {
    monitorStatusChanges();
    SpreadsheetApp.getUi().alert('✅ 检查完成', '手动检查已完成，请查看日志了解详情', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (error) {
    const errorMessage = '❌ 检查时出错:\n\n' + error.toString();
    SpreadsheetApp.getUi().alert('检查失败', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * 重新设置每日健康检查触发器（修复时区问题）
 */
function fixDailyHealthCheckTrigger() {
  try {
    Logger.log('开始修复每日健康检查触发器...');
    
    // 删除现有的健康检查触发器
    const triggers = ScriptApp.getProjectTriggers();
    let deletedCount = 0;
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'sendDailyHealthCheck') {
        ScriptApp.deleteTrigger(trigger);
        deletedCount++;
        Logger.log('删除了旧的健康检查触发器');
      }
    });
    
    // 重新创建正确的触发器
    // 北京时间21:30 = UTC 13:30
    ScriptApp.newTrigger('sendDailyHealthCheck')
      .timeBased()
      .everyDays(1)
      .atHour(13) // UTC 13:30
      .nearMinute(30)
      .create();
    
    Logger.log('已创建新的健康检查触发器 (UTC 13:30 = 北京时间 21:30)');
    
    const message = `✅ 每日健康检查触发器已修复！\n\n` +
                   `删除了 ${deletedCount} 个旧触发器\n` +
                   `新触发器时间: 每天UTC 13:30 (北京时间21:30)\n\n` +
                   `现在应该不会在错误的时间触发了。`;
    
    SpreadsheetApp.getUi().alert('触发器修复完成', message, SpreadsheetApp.getUi().ButtonSet.OK);
    
  } catch (error) {
    const errorMessage = '❌ 修复触发器时出错:\n\n' + error.toString();
    SpreadsheetApp.getUi().alert('修复失败', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    Logger.log('修复触发器错误: ' + error.toString());
  }
}

/**
 * 检查所有触发器状态
 */
function checkAllTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    
    Logger.log('=== 检查所有触发器 ===');
    Logger.log(`总触发器数量: ${triggers.length}`);
    
    if (triggers.length === 0) {
      Logger.log('没有找到任何触发器');
      SpreadsheetApp.getUi().alert('触发器检查', '没有找到任何触发器', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
    
    let triggerInfo = '触发器列表:\n\n';
    
    triggers.forEach((trigger, index) => {
      const handlerFunction = trigger.getHandlerFunction();
      const triggerSource = trigger.getTriggerSource();
      const eventType = trigger.getEventType();
      
      Logger.log(`触发器 ${index + 1}:`);
      Logger.log(`  - 函数: ${handlerFunction}`);
      Logger.log(`  - 来源: ${triggerSource}`);
      Logger.log(`  - 事件类型: ${eventType}`);
      
      triggerInfo += `${index + 1}. ${handlerFunction}\n`;
      triggerInfo += `   来源: ${triggerSource}\n`;
      triggerInfo += `   类型: ${eventType}\n`;
      
      // 如果是时间触发器，显示更多详情
      if (triggerSource.toString() === 'CLOCK') {
        try {
          // 注意：某些触发器属性可能无法直接访问
          triggerInfo += `   (时间触发器)\n`;
        } catch (e) {
          Logger.log(`  - 无法获取时间触发器详情: ${e.toString()}`);
        }
      }
      
      triggerInfo += '\n';
    });
    
    SpreadsheetApp.getUi().alert('触发器检查完成', triggerInfo, SpreadsheetApp.getUi().ButtonSet.OK);
    Logger.log('触发器检查完成');
    
  } catch (error) {
    Logger.log('检查触发器时出错: ' + error.toString());
    SpreadsheetApp.getUi().alert('检查失败', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * 调试脚本属性功能
 */
function debugScriptProperties() {
  try {
    const properties = PropertiesService.getScriptProperties();
    const testKey = 'DEBUG_TEST_KEY';
    const testValue = 'DEBUG_TEST_VALUE_' + new Date().getTime();
    
    Logger.log('=== 调试脚本属性功能 ===');
    
    // 测试保存
    Logger.log(`尝试保存测试数据: ${testKey} = ${testValue}`);
    properties.setProperty(testKey, testValue);
    Logger.log('保存完成');
    
    // 测试读取
    Logger.log('尝试读取测试数据...');
    const retrievedValue = properties.getProperty(testKey);
    Logger.log(`读取到的值: ${retrievedValue}`);
    
    if (retrievedValue === testValue) {
      Logger.log('✅ 脚本属性功能正常');
    } else {
      Logger.log('❌ 脚本属性功能异常');
    }
    
    // 检查现有的监控数据
    Logger.log('\n=== 检查现有监控数据 ===');
    MONITORED_SHEETS.forEach(sheetConfig => {
      const data = properties.getProperty(sheetConfig.propertyKey);
      Logger.log(`${sheetConfig.propertyKey}: ${data ? '有数据' : '无数据'}`);
      if (data) {
        try {
          const parsedData = JSON.parse(data);
          Logger.log(`  - 数据条数: ${parsedData.length}`);
        } catch (e) {
          Logger.log(`  - 数据解析错误: ${e.toString()}`);
        }
      }
    });
    
    // 检查最后检测时间
    const lastCheckTime = properties.getProperty('LAST_CHECK_TIME');
    Logger.log(`最后检测时间: ${lastCheckTime || '未设置'}`);
    
    // 清理测试数据
    properties.deleteProperty(testKey);
    Logger.log('测试数据已清理');
    
    SpreadsheetApp.getUi().alert('调试完成', '请查看执行记录了解详情', SpreadsheetApp.getUi().ButtonSet.OK);
    
  } catch (error) {
    Logger.log('调试过程中出错: ' + error.toString());
    SpreadsheetApp.getUi().alert('调试失败', error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * 初始化监控基准数据（不发送通知）
 */
function initializeMonitoringBaseline() {
  try {
    Logger.log('开始初始化监控基准数据...');
    
    let totalInitialized = 0;
    
    // 遍历所有需要监控的工作表
    for (const sheetConfig of MONITORED_SHEETS) {
      try {
        Logger.log(`初始化 ${sheetConfig.displayName} (${sheetConfig.name})...`);
        
        // 获取工作表
        const sheet = getSheet(sheetConfig.name);
        if (!sheet) {
          Logger.log(`警告: 找不到工作表 ${sheetConfig.name}，跳过初始化`);
          continue;
        }
        
        // 获取当前数据作为基准
        const currentData = getCurrentData(sheet, sheetConfig.name);
        
        // 保存为原决策基准
        saveOriginalDecisions(sheetConfig.propertyKey, currentData);
        
        totalInitialized += currentData.length;
        Logger.log(`${sheetConfig.displayName}基准初始化完成，保存了 ${currentData.length} 条数据`);
        
      } catch (error) {
        Logger.log(`初始化 ${sheetConfig.name} 时出错: ${error.toString()}`);
      }
    }
    
    const message = `✅ 监控基准初始化完成！\n\n共初始化了 ${totalInitialized} 条基准数据\n\n现在可以正常进行监控了。`;
    SpreadsheetApp.getUi().alert('初始化完成', message, SpreadsheetApp.getUi().ButtonSet.OK);
    Logger.log(`监控基准初始化完成，总共初始化了 ${totalInitialized} 条数据`);
    
  } catch (error) {
    const errorMessage = '❌ 初始化基准数据时出错:\n\n' + error.toString();
    SpreadsheetApp.getUi().alert('初始化失败', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    Logger.log('初始化基准数据错误: ' + error.toString());
  }
}

/**
 * 清除历史数据（重置监控基准）
 */
function resetMonitoringData() {
  try {
    const properties = PropertiesService.getScriptProperties();
    
    // 清除所有监控工作表的历史数据
    MONITORED_SHEETS.forEach(sheetConfig => {
      properties.deleteProperty(sheetConfig.propertyKey);
    });
    
    const sheetNames = MONITORED_SHEETS.map(sheet => sheet.displayName).join('、');
    SpreadsheetApp.getUi().alert('✅ 重置完成', 
      `${sheetNames}的监控基准数据已清除，请运行"初始化监控基准"重新建立基准`, 
      SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (error) {
    const errorMessage = '❌ 重置时出错:\n\n' + error.toString();
    SpreadsheetApp.getUi().alert('重置失败', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * 获取北京时间
 */
function getBeijingTime() {
  const now = new Date();
  return new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (8 * 3600000));
}

/**
 * 格式化北京时间
 */
function formatBeijingTime(beijingTime) {
  const year = beijingTime.getFullYear();
  const month = (beijingTime.getMonth() + 1).toString().padStart(2, '0');
  const day = beijingTime.getDate().toString().padStart(2, '0');
  const hours = beijingTime.getHours().toString().padStart(2, '0');
  const minutes = beijingTime.getMinutes().toString().padStart(2, '0');
  const seconds = beijingTime.getSeconds().toString().padStart(2, '0');
  
  return `${year}/${month}/${day}, ${hours}:${minutes}:${seconds}`;
}

/**
 * 配置企业微信 Webhook Key
 */
function configureWeChatWebhook() {
  try {
    const ui = SpreadsheetApp.getUi();
    const properties = PropertiesService.getScriptProperties();
    const currentKey = properties.getProperty('WECHAT_WEBHOOK_KEY');
    
    const promptText = currentKey ? 
      `当前企业微信 Webhook Key: ${currentKey.substring(0, 10)}...\n\n请输入新的 Webhook Key（留空保持不变）:` :
      '请输入企业微信 Webhook Key:';
    
    const response = ui.prompt('配置企业微信通知', promptText, ui.ButtonSet.OK_CANCEL);
    
    if (response.getSelectedButton() === ui.Button.OK) {
      const newKey = response.getResponseText().trim();
      
      if (newKey) {
        properties.setProperty('WECHAT_WEBHOOK_KEY', newKey);
        ui.alert('✅ 配置成功', '企业微信 Webhook Key 已保存', ui.ButtonSet.OK);
        Logger.log('企业微信 Webhook Key 已更新');
      } else if (!currentKey) {
        ui.alert('⚠️ 配置取消', '未输入 Webhook Key', ui.ButtonSet.OK);
      } else {
        ui.alert('ℹ️ 保持不变', '企业微信 Webhook Key 未修改', ui.ButtonSet.OK);
      }
    }
  } catch (error) {
    const errorMessage = '❌ 配置企业微信 Webhook 时出错:\n\n' + error.toString();
    SpreadsheetApp.getUi().alert('配置失败', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    Logger.log('配置企业微信 Webhook 错误: ' + error.toString());
  }
}

/**
 * 测试企业微信通知
 */
function testWeChatNotification() {
  try {
    const properties = PropertiesService.getScriptProperties();
    const webhookKey = properties.getProperty('WECHAT_WEBHOOK_KEY');
    
    if (!webhookKey) {
      SpreadsheetApp.getUi().alert('⚠️ 配置缺失', '请先配置企业微信 Webhook Key', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
    
    const timeString = formatBeijingTime(getBeijingTime());
    const testMessage = `🧪 NoFina 监控系统测试通知\n\n这是一条测试消息，用于验证企业微信通知功能是否正常工作。\n\n⏰ 测试时间: ${timeString}`;
    
    const payload = {
      "msgtype": "text",
      "text": {
        "content": testMessage
      }
    };
    
    const webhookUrl = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${webhookKey}`;
    const options = {
      'method': 'POST',
      'headers': {
        'Content-Type': 'application/json'
      },
      'payload': JSON.stringify(payload)
    };
    
    const response = UrlFetchApp.fetch(webhookUrl, options);
    const responseData = JSON.parse(response.getContentText());
    
    if (responseData.errcode === 0) {
      SpreadsheetApp.getUi().alert('✅ 测试成功', '企业微信通知发送成功！请检查您的企业微信群。', SpreadsheetApp.getUi().ButtonSet.OK);
      Logger.log('企业微信测试通知发送成功');
    } else {
      const errorMsg = `❌ 测试失败\n\n错误信息: ${responseData.errmsg}\n错误码: ${responseData.errcode}`;
      SpreadsheetApp.getUi().alert('测试失败', errorMsg, SpreadsheetApp.getUi().ButtonSet.OK);
      Logger.log(`企业微信测试通知发送失败: ${responseData.errmsg} (错误码: ${responseData.errcode})`);
    }
    
  } catch (error) {
    const errorMessage = '❌ 测试企业微信通知时出错:\n\n' + error.toString();
    SpreadsheetApp.getUi().alert('测试失败', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
    Logger.log('测试企业微信通知错误: ' + error.toString());
  }
}

/**
 * 每日健康检查通知 - 每天晚上9:30发送
 */
function sendDailyHealthCheck() {
  try {
    const properties = PropertiesService.getScriptProperties();
    const webhookKey = properties.getProperty('WECHAT_WEBHOOK_KEY');
    
    if (!webhookKey) {
      Logger.log('未配置企业微信 webhook key，跳过每日健康检查通知');
      return;
    }
    
    const timeString = formatBeijingTime(getBeijingTime());
    const healthMessage = `🧪 NoFina 监控系统正常\n\n系统运行状态良好，监控功能正常工作中。\n\n⏰ 检查时间: ${timeString}`;
    
    const payload = {
      "msgtype": "text",
      "text": {
        "content": healthMessage
      }
    };
    
    const webhookUrl = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${webhookKey}`;
    const options = {
      'method': 'POST',
      'headers': {
        'Content-Type': 'application/json'
      },
      'payload': JSON.stringify(payload)
    };
    
    const response = UrlFetchApp.fetch(webhookUrl, options);
    const responseData = JSON.parse(response.getContentText());
    
    if (responseData.errcode === 0) {
      Logger.log('每日健康检查通知发送成功');
    } else {
      Logger.log(`每日健康检查通知发送失败: ${responseData.errmsg} (错误码: ${responseData.errcode})`);
    }
    
  } catch (error) {
    Logger.log('发送每日健康检查通知时出错: ' + error.toString());
  }
}

/**
 * 创建菜单
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const sheetNames = MONITORED_SHEETS.map(sheet => sheet.displayName).join('&');
  
  ui.createMenu(`📊 ${sheetNames}状态监控`)
    .addItem('🚀 开始监控 (每5分钟)', 'setupMonitoringTrigger')
    .addItem('⏹️ 停止监控', 'stopMonitoring')
    .addSeparator()
    .addItem('🔧 初始化监控基准', 'initializeMonitoringBaseline')
    .addItem('🔍 手动检查一次', 'checkChangesOnce')
    .addItem('🔄 重置监控数据', 'resetMonitoringData')
    .addSeparator()
    .addItem('🐛 调试脚本属性', 'debugScriptProperties')
    .addItem('🔍 检查所有触发器', 'checkAllTriggers')
    .addItem('🔧 修复健康检查触发器', 'fixDailyHealthCheckTrigger')
    .addItem('📋 查看监控状态', 'showMonitoringStatus')
    .addSeparator()
    .addItem('💬 配置企业微信通知', 'configureWeChatWebhook')
    .addItem('🧪 测试企业微信通知', 'testWeChatNotification')
    .addSeparator()
    .addItem('⏰ 开启每日健康检查 (9:30PM)', 'setupDailyHealthCheckTrigger')
    .addItem('⏹️ 停止每日健康检查', 'stopDailyHealthCheck')
    .addToUi();
}

/**
 * 获取最后检测时间
 */
function getLastCheckTime() {
  try {
    const properties = PropertiesService.getScriptProperties();
    return properties.getProperty('LAST_CHECK_TIME') || '未知';
  } catch (error) {
    Logger.log(`获取最后检测时间时出错: ${error.toString()}`);
    return '获取失败';
  }
}

/**
 * 显示监控状态
 */
function showMonitoringStatus() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const monitoringTriggers = triggers.filter(trigger => 
      trigger.getHandlerFunction() === 'monitorStatusChanges'
    );
    const healthCheckTriggers = triggers.filter(trigger => 
      trigger.getHandlerFunction() === 'sendDailyHealthCheck'
    );
    
    const properties = PropertiesService.getScriptProperties();
    const lastCheckTime = getLastCheckTime();
    
    let status = '📊 状态监控状态\n\n';
    
    if (monitoringTriggers.length > 0) {
      status += '✅ 监控状态: 运行中\n';
      status += `📅 触发器数量: ${monitoringTriggers.length}\n`;
      status += '⏰ 监控频率: 每5分钟\n';
      status += `🕐 最后检测时间: ${lastCheckTime}\n`;
    } else {
      status += '⏹️ 监控状态: 已停止\n';
    }
    
    if (healthCheckTriggers.length > 0) {
      status += '✅ 每日健康检查: 运行中 (每天21:30)\n';
    } else {
      status += '⏹️ 每日健康检查: 已停止\n';
    }
    
    status += '\n📋 监控工作表:\n';
    MONITORED_SHEETS.forEach(sheetConfig => {
      const hasStoredData = properties.getProperty(sheetConfig.propertyKey) !== null;
      status += `• ${sheetConfig.displayName} (${sheetConfig.name}): ${hasStoredData ? '✅ 已建立基准' : '⚠️ 未建立基准'}\n`;
    });
    
    status += `\n📍 标题行: 第${HEADER_ROW}行\n`;
    status += `📊 监控列: 简要决策 (第${DECISION_COLUMN}列)\n`;
    status += '📝 记录表: "状态变化记录"\n';
    
    SpreadsheetApp.getUi().alert('监控状态', status, SpreadsheetApp.getUi().ButtonSet.OK);
    
  } catch (error) {
    const errorMessage = '❌ 获取状态时出错:\n\n' + error.toString();
    SpreadsheetApp.getUi().alert('状态查询失败', errorMessage, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
