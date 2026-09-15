# Aplicación móvil Android

Cliente Flutter del sistema ProyectoSoftware1. Permite iniciar sesión, consultar espacios de trabajo y diagramas, editar estructuras UML, trabajar sin conexión y usar el asistente por texto o voz.

La plataforma móvil soportada en esta etapa es exclusivamente Android; no se incluye una compilación para iOS.

## Arquitectura de IA híbrida

- El motor compacto incluido en la aplicación interpreta sin internet órdenes básicas como crear clases, agregar atributos y consultar ayuda.
- El reconocimiento y la síntesis de voz se solicitan en modo local al servicio disponible en el dispositivo Android.
- Las solicitudes complejas se derivan a la IA del backend únicamente cuando existe conexión.
- Ningún cambio propuesto por la IA remota se aplica sin confirmación del usuario.

## Trabajo sin conexión

Los proyectos y diagramas consultados se guardan localmente. Las modificaciones realizadas sin conexión se mantienen en una cola durable y se sincronizan al recuperar la red. Si la versión remota cambió, el cliente realiza una combinación de tres vías y conserva los cambios conflictivos para su revisión.

## Ejecutar en local

Requisitos: Flutter 3.35 o posterior, Android SDK 35 y un backend local en ejecución.

```powershell
cd mobile
flutter pub get
flutter run
```

La URL predeterminada `http://10.0.2.2:3002/api` sirve para el emulador de Android. En un teléfono físico, introduzca en la pantalla de acceso la IP LAN del equipo, por ejemplo `http://192.168.1.20:3002/api`. El teléfono y el equipo deben estar en la misma red y el puerto 3002 debe estar permitido por el firewall.

Para instalar una compilación de depuración:

```powershell
flutter build apk --debug
adb install -r build\app\outputs\flutter-apk\app-debug.apk
```

El APK resultante queda en `mobile/build/app/outputs/flutter-apk/app-debug.apk`.

## Verificación

```powershell
flutter analyze
flutter test
flutter build apk --debug
```
