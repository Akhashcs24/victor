// This Pine Script® code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/
// © jabez4jc

//@version=6
indicator('NSE/BSE Derivative - Next Expiry Date With Holidays', 'NextExpiry', overlay = true)

// === USER CONFIGURABLE HOLIDAYS (YYYY-MM-DD format) ===
// === Editable holiday list input ===
table_position = input.string(defval = 'Top Right', title = 'Table Position', options = ['Top Right', 'Top Left', 'Bottom Right', 'Bottom Left'], display = display.none, inline = 'table')

table_pos = table_position == 'Top Left' ? position.top_left : table_position == 'Bottom Right' ? position.bottom_right : table_position == 'Bottom Left' ? position.bottom_left : position.top_right // default

font_size_input = input.string(defval = 'normal', title = 'Text Size', options = ['tiny', 'small', 'normal', 'large'], display = display.none, inline = 'table')

holiday_raw = input.string(defval = '2025-02-26,2025-03-14,2025-03-31,2025-04-10,2025-04-14,2025-04-18,2025-05-01,2025-08-15,2025-08-27,2025-10-02,2025-10-21,2025-10-22,2025-11-05,2025-12-25', title = 'Holidays', tooltip = 'Enter dates as: YYYY-MM-DD,YYYY-MM-DD,...', display = display.none)
holiday_strs = str.split(holiday_raw, ',')

// === Safe string-to-timestamp converter ===
str_to_timestamp_safe(date_str) =>
    y_str = str.substring(date_str, 0, 4)
    m_str = str.substring(date_str, 5, 7)
    d_str = str.substring(date_str, 8, 10)
    y = na(y_str) or str.length(y_str) < 4 ? na : int(str.tonumber(y_str))
    m = na(m_str) or str.length(m_str) < 2 ? na : int(str.tonumber(m_str))
    d = na(d_str) or str.length(d_str) < 2 ? na : int(str.tonumber(d_str))
    na(y) or na(m) or na(d) ? na : timestamp(y, m, d, 0, 0)

// === Initialize and populate holiday timestamps array ===
var holiday_timestamps = array.new_int()

if array.size(holiday_timestamps) == 0
    for i = 0 to array.size(holiday_strs) - 1 by 1
        date_str = array.get(holiday_strs, i)
        ts = str_to_timestamp_safe(date_str)
        if not na(ts)
            array.push(holiday_timestamps, ts)

// === Check if a timestamp is a weekend or a holiday ===
is_holiday(ts) =>
    wd = dayofweek(ts)
    is_weekend = wd == dayofweek.saturday or wd == dayofweek.sunday
    in_holidays = false
    if array.size(holiday_timestamps) > 0
        for i = 0 to array.size(holiday_timestamps) - 1 by 1
            in_holidays := in_holidays or ts == array.get(holiday_timestamps, i)
            in_holidays
    is_weekend or in_holidays

// === Adjust expiry date to previous working day if it's a holiday ===
adjust_for_holiday(original_ts) =>
    new_ts = original_ts
    while is_holiday(new_ts)
        new_ts := new_ts - 24 * 60 * 60 * 1000
        new_ts
    new_ts

// === Helper: Last weekday of month ===
get_last_weekday_in_month(year, month, weekday) =>
    last_day = timestamp(year, month + 1, 0, 0, 0)
    dow = dayofweek(last_day)
    offset = dow >= weekday ? dow - weekday : dow + 7 - weekday
    last = last_day - offset * 24 * 60 * 60 * 1000
    last

// === Helper: Next weekday for weekly expiry ===
get_next_weekday(ts, weekday) =>
    cur_dow = dayofweek(ts)
    offset = weekday >= cur_dow ? weekday - cur_dow : 7 - (cur_dow - weekday)
    ts + offset * 24 * 60 * 60 * 1000

// === Date variables ===
year_now = year(time)
month_now = month(time)
today = timestamp(year_now, month_now, dayofmonth(time), 0, 0)

// === NSE Monthly Expiry (Thursday)
nse_expiry_this = adjust_for_holiday(get_last_weekday_in_month(year_now, month_now, dayofweek.thursday))
nse_expiry_next = adjust_for_holiday(get_last_weekday_in_month(year_now + (month_now == 12 ? 1 : 0), month_now == 12 ? 1 : month_now + 1, dayofweek.thursday))
nse_expiry = nse_expiry_this >= today ? nse_expiry_this : nse_expiry_next

// === BSE Monthly Expiry (Tuesday)
bse_expiry_this = adjust_for_holiday(get_last_weekday_in_month(year_now, month_now, dayofweek.tuesday))
bse_expiry_next = adjust_for_holiday(get_last_weekday_in_month(year_now + (month_now == 12 ? 1 : 0), month_now == 12 ? 1 : month_now + 1, dayofweek.tuesday))
bse_expiry = bse_expiry_this >= today ? bse_expiry_this : bse_expiry_next

// === Weekly Expiries
nifty_weekly = adjust_for_holiday(get_next_weekday(today, dayofweek.thursday))
sensex_weekly = adjust_for_holiday(get_next_weekday(today, dayofweek.tuesday))

// === Format date as string ===
format_date(ts) =>
    y = str.tostring(year(ts))
    m = str.tostring(month(ts))
    d = str.tostring(dayofmonth(ts))
    y + '-' + (str.length(m) == 1 ? '0' + m : m) + '-' + (str.length(d) == 1 ? '0' + d : d)

nse_expiry_str = format_date(nse_expiry)
bse_expiry_str = format_date(bse_expiry)
nifty_weekly_str = format_date(nifty_weekly)
sensex_weekly_str = format_date(sensex_weekly)

// === Row highlight logic
highlight_color = color.teal

default_bg = color.new(color.black, 100)

bg_nifty = nifty_weekly == today ? highlight_color : default_bg
bg_banknifty = nse_expiry == today ? highlight_color : default_bg
bg_finnifty = nse_expiry == today ? highlight_color : default_bg
bg_midcp = nse_expiry == today ? highlight_color : default_bg
bg_nxt50 = nse_expiry == today ? highlight_color : default_bg
bg_sensex = sensex_weekly == today ? highlight_color : default_bg
bg_bankex = bse_expiry == today ? highlight_color : default_bg
bg_sensex50 = bse_expiry == today ? highlight_color : default_bg
bg_stockfo = nse_expiry == today ? highlight_color : default_bg

// === Table Display ===
var table expiry_table = table.new(table_pos, 2, 10, frame_color = color.gray, border_width = 1)

if bar_index % 5 == 0
    table.cell(expiry_table, 0, 0, 'Derivative', text_color = color.white, bgcolor = color.blue, text_size = font_size_input)
    table.cell(expiry_table, 1, 0, 'Next Expiry', text_color = color.white, bgcolor = color.blue, text_size = font_size_input)

    table.cell(expiry_table, 0, 1, 'NIFTY (Weekly)', text_color = color.white, bgcolor = bg_nifty, text_size = font_size_input)
    table.cell(expiry_table, 1, 1, nifty_weekly_str, text_color = color.white, bgcolor = bg_nifty, text_size = font_size_input)

    table.cell(expiry_table, 0, 2, 'BANKNIFTY', text_color = color.white, bgcolor = bg_banknifty, text_size = font_size_input)
    table.cell(expiry_table, 1, 2, nse_expiry_str, text_color = color.white, bgcolor = bg_banknifty, text_size = font_size_input)

    table.cell(expiry_table, 0, 3, 'FINNIFTY', text_color = color.white, bgcolor = bg_finnifty, text_size = font_size_input)
    table.cell(expiry_table, 1, 3, nse_expiry_str, text_color = color.white, bgcolor = bg_finnifty, text_size = font_size_input)

    table.cell(expiry_table, 0, 4, 'MIDCPNIFTY', text_color = color.white, bgcolor = bg_midcp, text_size = font_size_input)
    table.cell(expiry_table, 1, 4, nse_expiry_str, text_color = color.white, bgcolor = bg_midcp, text_size = font_size_input)

    table.cell(expiry_table, 0, 5, 'NIFTYNXT50', text_color = color.white, bgcolor = bg_nxt50, text_size = font_size_input)
    table.cell(expiry_table, 1, 5, nse_expiry_str, text_color = color.white, bgcolor = bg_nxt50, text_size = font_size_input)

    table.cell(expiry_table, 0, 6, 'SENSEX (Weekly)', text_color = color.white, bgcolor = bg_sensex, text_size = font_size_input)
    table.cell(expiry_table, 1, 6, sensex_weekly_str, text_color = color.white, bgcolor = bg_sensex, text_size = font_size_input)

    table.cell(expiry_table, 0, 7, 'BANKEX', text_color = color.white, bgcolor = bg_bankex, text_size = font_size_input)
    table.cell(expiry_table, 1, 7, bse_expiry_str, text_color = color.white, bgcolor = bg_bankex, text_size = font_size_input)

    table.cell(expiry_table, 0, 8, 'SENSEX 50', text_color = color.white, bgcolor = bg_sensex50, text_size = font_size_input)
    table.cell(expiry_table, 1, 8, bse_expiry_str, text_color = color.white, bgcolor = bg_sensex50, text_size = font_size_input)

    table.cell(expiry_table, 0, 9, 'Stocks (F&O)', text_color = color.white, bgcolor = bg_stockfo, text_size = font_size_input)
    table.cell(expiry_table, 1, 9, nse_expiry_str, text_color = color.white, bgcolor = bg_stockfo, text_size = font_size_input)
