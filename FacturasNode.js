const express = require('express');
const https = require('https');
const querystring = require('querystring');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const bodyParser = require('body-parser');
const csv = require('csv-writer').createObjectCsvWriter;
const AdmZip = require('adm-zip');
const { Parser } = require('xml2js');
const multer = require('multer');
const XLSX = require('xlsx'); // Agrega la biblioteca xlsx
//const pdfParse  = require('pdf-parse')
const PDFParser   = require('pdf2json')
let facturasProcesadas = [];
const app = express();
// Configurar el middleware multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Define el directorio donde se almacenarán temporalmente los archivos subidos
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); // Conservar el nombre original del archivo
    },
});
const upload = multer({ storage }); // Define el directorio donde se almacenarán temporalmente los archivos subidos
app.use(upload.array('files')); // 'files' debe coincidir con el name del input en el formulario HTML

app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.use(bodyParser.urlencoded({ extended: true }));
// Ruta para mostrar el formulario de selección de carpeta
app.get('/', (req, res) => {
    const html = `
    <html>
        <body>
            <h1>Procesar Archivos PDF MAC CENTER</h1>
            <form action="/procesarArchivos" method="post" enctype="multipart/form-data">
                <label for="directory">Seleccione la carpeta:</label>
                <input type="file" id="directory" name="files" multiple required><br>
                <button type="submit">Procesar Archivos XML</button>
            </form>
        </body>
    </html>
`;
    res.send(html);
});
// Crear el directorio "uploads" si no existe
const uploadsDirectory = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDirectory)) {
    fs.mkdirSync(uploadsDirectory);
}

// Ruta para procesar los archivos XML en la carpeta seleccionada
app.post('/procesarArchivos', async (req, res) => {
    const files = req.files; // Obtener la ruta del directorio desde el cuerpo de la solicitud
    if (!files || !Array.isArray(files) || files.length === 0) {
        res.status(400).send('No files selected');
        return;
    }
    const directoryPath = 'uploads/';
    facturasProcesadas = [];
    try {
        for (const file of files) {
            let factura = await processXMLs(directoryPath, file.originalname);
            if (factura) {
                facturasProcesadas.push(factura); // Agregar la factura procesada al arreglo
            }
        }
        const message = 'Archivos PDF procesados';
        res.redirect(`/success?message=${encodeURIComponent(message)}&facturas=${encodeURIComponent(JSON.stringify(facturasProcesadas))}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred while processing XML files.');
    }

});
// Iniciar el servidor  
app.listen(process.env.PORT || 3000);
console.log('Servidor iniciado en el puerto', process.env.PORT || 3000);

function findDescriptionRecursive(obj) {
    for (const key in obj) {
        if (typeof obj[key] === 'object') {
            if (key === 'cbc:Description') {
                return obj[key];
            } else {
                const result = findDescriptionRecursive(obj[key]);
                if (result) {
                    return result;
                }
            }
        }
    }
    return null;
}
function extraerInformacionXML(parsedData) {
    let cbcPayableAmount = 0; // Declarar la variable cbcPayableAmount
    let cbcdesc;
    if (parsedData.AttachedDocument && Array.isArray(parsedData.AttachedDocument['cac:Attachment']) &&
        parsedData.AttachedDocument['cac:Attachment'].length > 0
    ) {
        // Obtener el primer elemento dentro del array 'cac:Attachment'
        const attachment = parsedData.AttachedDocument['cac:Attachment'][0];
        //console.log('Contenido de "cac:Attachment":', attachment);

        // Verificar si 'cac:ExternalReference' existe en el elemento 'cac:Attachment'
        if (
            attachment['cac:ExternalReference'] &&
            Array.isArray(attachment['cac:ExternalReference']) &&
            attachment['cac:ExternalReference'].length > 0 &&
            attachment['cac:ExternalReference'][0]['cbc:Description']
        ) {
            const description = attachment['cac:ExternalReference'][0]['cbc:Description'][0];
            const parser = new xml2js.Parser();
            let parsedDescription;

            parser.parseString(description, (err, result) => {
                if (err) {
                    console.error('Error parsing XML:', err);
                    return;
                }
                parsedDescription = result;
                //console.log('Contenido de "cbc:Description" como objeto JavaScript:', parsedDescription);

                // Verificar si 'cac:LegalMonetaryTotal' existe en el objeto 'parsedDescription'
                if (
                    parsedDescription['Invoice'] &&
                    parsedDescription['Invoice']['cac:LegalMonetaryTotal'] &&
                    Array.isArray(parsedDescription['Invoice']['cac:LegalMonetaryTotal']) &&
                    parsedDescription['Invoice']['cac:LegalMonetaryTotal'].length > 0 &&
                    parsedDescription['Invoice']['cac:LegalMonetaryTotal'][0]['cbc:PayableAmount']
                ) {
                    // Obtener el valor de 'cbc:PayableAmount'
                    cbcPayableAmount = parsedDescription['Invoice']['cac:LegalMonetaryTotal'][0]['cbc:PayableAmount'][0]._;
                    //console.log('Valor de "cbc:PayableAmount":', cbcPayableAmount);
                } else {
                    console.log('No se encontró el elemento "cbc:PayableAmount" dentro de "cac:LegalMonetaryTotal".');
                }
                // Verificar si 'cac:LegalMonetaryTotal' existe en el objeto 'parsedDescription'
                let cbcdesc1 = findDescriptionRecursive(parsedDescription);
                cbcdesc = cbcdesc1.join("")
                if (cbcdesc) {
                    //console.log('Valor de "cbcdesc":', cbcdesc);
                } else {
                    console.log('No se encontró el elemento "cbc:PayableAmount" dentro de "cbc:Description".');
                }
            });


        } else {
            console.log('No se encontró el elemento "cbc:ExternalReference" o "cbc:Description" dentro de "cac:Attachment".');
        }
    } else {
        console.log('No se encontró el elemento "cac:Attachment" o está vacío.');
    }
    let factura = parsedData['AttachedDocument']['cbc:ID'] && parsedData['AttachedDocument']['cbc:ID'][0] || '';
    let fecha = parsedData['AttachedDocument']['cbc:IssueDate'] && parsedData['AttachedDocument']['cbc:IssueDate'][0] || '';
    const valor = parseInt(cbcPayableAmount); // Convertir el valor a número, si es necesario
    const valor2 = valor.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
    let nit2 = parsedData['AttachedDocument']['cac:SenderParty'] && parsedData['AttachedDocument']['cac:SenderParty'][0]['cac:PartyTaxScheme'] && parsedData['AttachedDocument']['cac:SenderParty'][0]['cac:PartyTaxScheme'][0]['cbc:CompanyID'] && parsedData['AttachedDocument']['cac:SenderParty'][0]['cac:PartyTaxScheme'][0]['cbc:CompanyID'][0]['_'];
    let descripcion = cbcdesc || '';

    console.log('Factura:', factura);
    console.log('Fecha:', fecha);
    console.log('Valor:', valor);
    console.log('Descripción:', descripcion);
    console.log('Nit2:', nit2);

    return {
        factura,
        fecha,
        valor,
        valor2,
        descripcion,
        nit2,
    };
}
// Borrar el contenido de la carpeta temporal "uploads" después de procesar los archivos
function clearTempFolder(directoryPath) {
    try {
        const files = fs.readdirSync(directoryPath);
        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            fs.unlinkSync(filePath); // Elimina cada archivo de la carpeta
        }
        console.log('Temporary folder cleared.');
    } catch (error) {
        console.error('Error clearing temporary folder:', error);
    }
}
app.get('/success', (req, res) => {
    const { message, facturas } = req.query;
    const facturasProcesadas= JSON.parse(facturas); 
    const facturasProcesadas2= facturasProcesadas[0];    
        const htmlsucces = `
        <html>
            <body>
                <h3>${message}</h3>
                <h4>Facturas procesadas correctamente:</h4>
                <ul>
                ${facturasProcesadas2.map((facturas) => `<li>${facturas.factura}</li>`).join('')}                    
                </ul>
                <a href="/convertToExcel">Descargar EXCEL</a> <!-- Agregar enlace para descargar CSV -->
            </body>
        </html>
    `;
    res.send(htmlsucces);
});
app.get('/convertToExcel', (req, res) => {
    // Verifica si hay facturas procesadas
    if (facturasProcesadas.length === 0) {
        return res.status(400).send('No hay facturas procesadas para convertir.');
    }
    const facturasProcesadas2= facturasProcesadas[0]; 
    const excelFilePath = path.join(__dirname, 'datos.xlsx');    
     // Crea los datos para el archivo Excel
     const csvRows = facturasProcesadas2.map(factura => [
        factura.factura,
        factura.nit,
        factura.proveedor,  // o cualquier otro campo que quieras incluir
        factura.orden_compra,
        factura.entregado_a,
        factura.codigo_item,
        factura.descripcion,
        factura.valor
    ]);
    // Crear un objeto de trabajo de Excel
    const workbook = XLSX.utils.book_new();    
     worksheet = XLSX.utils.aoa_to_sheet(csvRows);
    // Agregar la hoja al libro de trabajo
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hoja1'); // 'Hoja1' es el nombre de la hoja
// Guardar el libro de trabajo como archivo Excel
    XLSX.writeFile(workbook, excelFilePath, { bookType: 'xlsx' });  
// Descargar el archivo Excel
    res. download(excelFilePath, 'datos.xlsx', (error) => {
        if (error) {
            console.error('Error downloading Excel:', error);
            res.status(500).send('Error downloading Excel file');
        } else {
            
           
console.log('Excel downloaded successfully.');
        }
    });
});

//Extrae el contenido del PDF y lo convierte a JSON
async function processInvoicePDF(filePath) {
    const pdfParser = new PDFParser();

    return new Promise((resolve, reject) => {
        pdfParser.on("pdfParser_dataError", errData => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", pdfData => {
            let allText = ""; // Combinar todo el texto
            const groupedTextByPage = [];

            pdfData.Pages.forEach(page => {
                // Paso 1: Combina todo el texto
                page.Texts.forEach(textItem => {
                    const text = decodeURIComponent(textItem.R.map(r => r.T).join(""));
                    allText += text + " ";
                });

                // Paso 3: Agrupa texto por coordenadas
                const grouped = {};
                page.Texts.forEach(textItem => {
                    const y = Math.round(textItem.y * 100); // Agrupar por posición Y
                    const text = decodeURIComponent(textItem.R.map(r => r.T).join(""));
                    if (!grouped[y]) grouped[y] = [];
                    grouped[y].push(text);
                });
                groupedTextByPage.push(grouped);
            });

            
            resolve({ allText: allText.trim(), groupedTextByPage });
        });
        pdfParser.loadPDF(filePath);
    });
}
// Procesar los archivos XML
async function processXMLs(directoryPath) {   
    const facturasProcesadas = [];   
    const files = fs.readdirSync(directoryPath);
     for (const file of files) {
        if (file.endsWith('.pdf')) {
            const filePath = path.join(directoryPath, file);            
            // Uso del flujo completo
            await processInvoicePDF(filePath).then(({  groupedTextByPage }) => {
                let array_GroupedTextByPage= groupedTextByPage[0];                
                var datos_extraidos ={
                    factura : array_GroupedTextByPage[415][0],
                    nit : array_GroupedTextByPage[238][0],
                    proveedor : array_GroupedTextByPage[161][0],
                    orden_compra : array_GroupedTextByPage[876][1],
                    entregado_a : array_GroupedTextByPage[1017][0],
                    codigo_item : array_GroupedTextByPage[1934][3],
                    descripcion : array_GroupedTextByPage[1934][0],
                    valor : array_GroupedTextByPage[1934][1],

                };
                facturasProcesadas.push(datos_extraidos);

            }).catch(error => console.error("Error:", error));
            fs.unlinkSync(filePath);
        } else {
            console.log(`Ignoring file "${file}" as it does not have a .xml extension.`);
        }
    }
    // Borrar el contenido de la carpeta temporal "uploads" después de procesar los archivos
    clearTempFolder(directoryPath);
    // Devolver el arreglo con las facturas procesadas
    return facturasProcesadas;
}