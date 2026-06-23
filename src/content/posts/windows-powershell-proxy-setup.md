---
title: "windows powershell 代理配置"
pubDatetime: 2022-02-19T21:38:54+08:00
description: "介绍在 Windows 的 PowerShell、Git Bash、CMD 以及 macOS 的 zsh 中配置 V2Ray 代理的命令，涵盖查看、设置和取消代理的具体方法。"
tags:
  - "windows"
---

## Powershell

### 查看代理

```
netsh winhttp show proxy
```

### 设置代理

```
# 设置仅本次有效
$env:HTTP_PROXY="http://127.0.0.1:10809"
$env:HTTPS_PROXY="https://127.0.0.1:10809"
```

或者

```
# 需要管理员权限
# 否则 Error writing proxy settings. (5) Access is denied.
netsh winhttp set proxy 127.0.0.1:10809
# or
netsh winhttp import proxy source=ie
```

### 取消代理

```
netsh winhttp reset proxy
```

## Git bash

### 设置代理

```
# 设置永久有效
git config --global https.proxy http://127.0.0.1:10809
git config --global https.proxy https://127.0.0.1:10809
git config --global http.proxy 'socks5://127.0.0.1:10808'
git config --global https.proxy 'socks5://127.0.0.1:10808'
git config --global --list	#查询代理设置
```

## CMD

### 设置代理

```
# 设置仅本次有效
$env:HTTP_PROXY="http://127.0.0.1:10809"
$env:HTTPS_PROXY="https://127.0.0.1:10809"
```

## Mac Proxy 命令

```
// 打开.zshrc
alias proxy='export all_proxy=http://127.0.0.1:1087'
alias unproxy='export unset all_proxy'
```
