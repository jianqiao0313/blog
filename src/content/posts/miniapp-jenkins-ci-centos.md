---
title: "CentOS 上用 Docker 部署 Jenkins（小程序 CI 准备）"
pubDatetime: 2020-04-06T22:29:09+08:00
description: "介绍在CentOS 7.4上通过Docker部署Jenkins的完整步骤，包括拉取镜像、创建数据目录、运行容器、获取初始密码及安装推荐插件，为小程序CI持续集成做准备。"
tags:
  - "小程序"
---
## 目录

## centos系统部署jenkins

## 准备
- docker（docker 要求 CentOS 系统的内核版本高于 3.10 ）
- 本次操作系统是centOS 7.4

## 安装步骤

### 拉取官方镜像

```
    docker pull jenkins/jenkins
```

![image](https://static.gezichenshan.top/blog/linux/centos-jenkins-0.png)

### 创建jenkins数据目录，并把文件夹权限变为777

```
    mkdir /root/jenkins_node
    chmod 777 /root/jenkins_node
```

![image](https://static.gezichenshan.top/blog/linux/centos-jenkins-1.png)

### 运行jenkins

```
    docker run -d --name jenkins -p 8081:8080 -p 50000:50000 -v /root/jenkins_node:/var/jen
```
![image](https://static.gezichenshan.top/blog/linux/centos-jenkins-2.png)

### 访问localhost:8081

![image](https://static.gezichenshan.top/blog/linux/centos-jenkins-3.png)

### 查看jenkins密码，并拷贝到页面上，点击继续

```
    cat /root/jenkins_node/secrets/initialAdminPassword
```

![image](https://static.gezichenshan.top/blog/linux/centos-jenkins-4.png)

![image](https://static.gezichenshan.top/blog/linux/centos-jenkins-5.png)

### 选择社区推荐的插件

![image](https://static.gezichenshan.top/blog/linux/centos-jenkins-6.png)

### 稍等片刻，插件安装中

![image](https://static.gezichenshan.top/blog/linux/centos-jenkins-7.png)

### 安装完成，jenkins就可以进入了

### 未完待续... to be continued...
