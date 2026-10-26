#!/usr/bin/env python3
"""Use the standard proxy route for Gradle without exposing proxy credentials."""
import os, pathlib, subprocess, sys, urllib.parse
root=pathlib.Path(__file__).resolve().parent.parent
env=os.environ.copy()
env.setdefault('GRADLE_USER_HOME','/workspace/gradle-cache')
env.setdefault('ANDROID_USER_HOME','/workspace/android-user')
local_jdk=pathlib.Path('/workspace/loop-toolchains/jdk21/usr/lib/jvm/java-21-openjdk-amd64')
if 'JAVA_HOME' not in env and local_jdk.exists(): env['JAVA_HOME']=str(local_jdk)
proxy=urllib.parse.urlparse(env.get('HTTPS_PROXY') or env.get('https_proxy') or '')
opts=[]
if proxy.hostname:
 for protocol in ('http','https'): opts.extend([f'-D{protocol}.proxyHost={proxy.hostname}',f'-D{protocol}.proxyPort={proxy.port or 80}'])
env['JAVA_OPTS']=' '.join([env.get('JAVA_OPTS',''),*opts])
raise SystemExit(subprocess.call([str(root/'android/gradlew'),'-p',str(root/'android'),*opts,*sys.argv[1:],'--max-workers=2','--console=plain'],env=env,cwd=root))
