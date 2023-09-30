# Procesador de Archivos XML
Este proyecto es un procesador de archivos XML que permite extraer información de facturas electrónicas y crear formularios en una API externa con los datos proporcionados. El proceso se realiza a través de un servidor Node.js utilizando el framework Express.

Autor
Empresa: GRM Colombia
Colaborador
David Rodriguez
Juan Carlos Olarte
Instalación y Configuración
Clona este repositorio en tu máquina local.
Ejecuta npm install para instalar las dependencias necesarias.
Uso
Ejecuta el servidor Node.js utilizando node app.js.
Accede a través de tu navegador web a http://localhost:3000.
Selecciona la carpeta que contiene los archivos XML a procesar y presiona el botón "Procesar Archivos XML".
El servidor procesará los archivos XML, extraerá la información relevante de cada factura y creará los formularios correspondientes en la API externa.
Los datos procesados se guardarán en un archivo CSV llamado datos.csv.
Dependencias
express
https
querystring
xml2js
fs
path
child_process
body-parser
csv-writer
adm-zip
multer
Configuración de la API Externa
Antes de ejecutar el servidor, asegúrate de configurar correctamente la API externa. Debes proporcionar las credenciales de autenticación en la función getAuthToken y definir los campos necesarios para la creación del formulario en la función createForm.

Nota
Este proyecto está en constante desarrollo y se pueden realizar mejoras adicionales para mejorar su funcionalidad y rendimiento.

¡Gracias por utilizar nuestro procesador de archivos XML! Si tienes alguna pregunta o problema, no dudes en contactarnos.





