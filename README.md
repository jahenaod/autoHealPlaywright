
# Auto reparado de pruebas con Playwright y AI

Funcionalidad de auto reparado de pruebas con el framework de automatizacion de pruebas Playwright junto con la ayuda de inteligencia artificial Chatgpt o Claude

Proyecto aun en etapa de desarrollo y experimentacion 

## Uso

 - Anthropic's Claude - Configura tu API key con ANTHROPIC_API_KEY.
 - OpenAI's GPT3 o GPT4 - Configura tu API key con OPENAI_API_KEY.

## Como instalar?

Mediante el administrador de paquetes de node utilizamos el siguente comando

    npm install autoheal-playwright

## Como ejecutar 
Debes declarar tu API Key del modelo que desees en la terminal antes de ejecutar

El comando de ejecucion es el siguente, recuerda activar el autoheal para aprovechar el beneficio del autocurado

    npx autoheal-playwright --testFile=TuArchivoTest.ts --model=gpt-3.5-turbo --autoheal=true

### Explicacion del comando de ejecucion

#### --testFile

Debes indicar el nombre del archivo el cual quieres ejecutar y en tal caso de que falle el programa intentara auto curarlo para poder seguir

### --model

Es el modelo de inteligencia artificial con el que quieres que se ejecute, por defecto se utiliza el gpt-3.5-turbo, si deseas usar el gpt4 verifica si tienes los accesos

### --autoheal

Funcionalidad de autocurado, por defecto esta en true/activada

#### Version 1 - Aun en desarrollo 
