import nodemailer from 'nodemailer';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import dotenv from 'dotenv';
import path from 'path';
import supabase from '../database';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isProd = process.env.NODE_ENV === 'production';

// Configuración de desarrollo
let gmailTransporter: nodemailer.Transporter | null = null;
if (!isProd) {
    gmailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
        },
    });
}

// Configuración de producción (SES)
let sesClient: SESClient | null = null;
if (isProd) {
    sesClient = new SESClient({
        region: process.env.AWS_REGION!,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
    });
}

async function sendEmail(to: string, subject: string, html: string) {
    try {
        if (!isProd && gmailTransporter) {
            await gmailTransporter.sendMail({
                from: process.env.GMAIL_USER,
                to,
                subject,
                html,
            });
            console.log(`Correo enviado a ${to} vía Gmail`);
        } else if (isProd && sesClient) {
            const command = new SendEmailCommand({
                Destination: { ToAddresses: [to] },
                Message: {
                    Body: { Html: { Charset: 'UTF-8', Data: html } },
                    Subject: { Charset: 'UTF-8', Data: subject },
                },
                Source: process.env.SES_FROM_EMAIL!,
            });
            await sesClient.send(command);
            console.log(`Correo enviado a ${to} vía SES`);
        } else { 
            throw new Error('No hay cliente de email configurado');
        }
    } catch (error: any) {
        console.error('Error al enviar correo:', error);
        try {
            await supabase.schema('sistema').from('lSistema').insert({
                id_usuario: null,
                mensaje_error: error.message || 'Error desconocido al enviar correo',
                detalle_error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
                clase: 'EmailService',
                metodo: 'sendEmail',
                ip_address: null,
                user_agent: null
            });
        } catch (logErr) {
            console.error('No se pudo guardar el error en lSistema:', logErr);
        }
        throw error;
    }
}

export async function sendWelcomeEmail(to: string, username: string) {
  const subject = '¡Bienvenido a Todonto! Tu consulta dental, ahora en digital 🦷';

  const html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenido(a) a Todonto</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f0f4f8; }

    @media only screen and (max-width: 600px) {
      .email-wrapper  { width: 100% !important; }
      .email-header   { padding: 28px 20px !important; }
      .email-body     { padding: 24px 20px !important; }
      .email-footer   { padding: 20px !important; }
      .feature-inner  { padding: 14px !important; }
      .cta-btn        { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">

<!-- Preheader oculto -->
<div style="display:none;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Tu cuenta está lista. Comienza a transformar la gestión de tu consulta desde hoy.
</div>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0f4f8;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table class="email-wrapper" role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">

        <!-- ===== HEADER ===== -->
        <tr>
          <td class="email-header" align="center"
            style="background-color:#185FA5;padding:36px 40px 30px;border-radius:14px 14px 0 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" width="54" height="54"
                        style="background-color:#0C447C;border-radius:14px;text-align:center;vertical-align:middle;font-size:26px;line-height:54px;width:54px;height:54px;">
                        🦷
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:#ffffff;font-size:24px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">
                    Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.6);font-size:11px;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Tu clínica dental digital
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== BODY ===== -->
        <tr>
          <td class="email-body"
            style="background-color:#ffffff;padding:36px 40px;border-left:1px solid #B5D4F4;border-right:1px solid #B5D4F4;">

            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Saludo -->
              <tr>
                <td style="padding-bottom:8px;">
                  <span style="font-size:22px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">
                    ¡Hola, ${username}! 👋
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <p style="margin:0;font-size:15px;color:#555555;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">
                    Nos alegra mucho que estés aquí. Tu cuenta en <strong style="color:#185FA5;">Todonto</strong> ya está lista. A partir de hoy, gestionar tu consulta dental será mucho más sencillo, ordenado y humano.
                  </p>
                </td>
              </tr>

              <!-- Divisor bicolor -->
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="35%" height="3" style="background-color:#185FA5;font-size:0;line-height:0;">&nbsp;</td>
                      <td width="65%" height="3" style="background-color:#B5D4F4;font-size:0;line-height:0;">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Etiqueta sección -->
              <tr>
                <td style="padding-bottom:14px;">
                  <span style="font-size:11px;font-weight:bold;color:#185FA5;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Con Todonto puedes
                  </span>
                </td>
              </tr>

              <!-- Feature: Agenda -->
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    📅
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;">
                                Agenda inteligente
                              </p>
                              <p style="margin:0;font-size:13px;color:#185FA5;font-family:Arial,Helvetica,sans-serif;line-height:1.55;">
                                Programa citas fácilmente con recordatorios automáticos para tus pacientes.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Feature: Expedientes -->
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    📋
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;">
                                Expedientes clínicos
                              </p>
                              <p style="margin:0;font-size:13px;color:#185FA5;font-family:Arial,Helvetica,sans-serif;line-height:1.55;">
                                Historial completo por paciente: diagnósticos, tratamientos y radiografías.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Feature: Pacientes -->
              <tr>
                <td style="padding-bottom:30px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    👥
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;">
                                Registro de pacientes
                              </p>
                              <p style="margin:0;font-size:13px;color:#185FA5;font-family:Arial,Helvetica,sans-serif;line-height:1.55;">
                                Alta, búsqueda y seguimiento desde un solo lugar, sin papeleo.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- CTA -->
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                    href="${process.env.FRONTEND_URL}" style="height:50px;v-text-anchor:middle;width:220px;" arcsize="20%"
                    fillcolor="#185FA5" strokecolor="#185FA5">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">
                      Acceder a mi cuenta &rarr;
                    </center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="background-color:#185FA5;border-radius:10px;">
                        <a class="cta-btn" href="${process.env.FRONTEND_URL}" target="_blank"
                          style="display:inline-block;background-color:#185FA5;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;padding:15px 40px;border-radius:10px;text-align:center;">
                          Acceder a mi cuenta &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                  <!--<![endif]-->
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:28px;">
                  <span style="font-size:12px;color:#aaaaaa;font-family:Arial,Helvetica,sans-serif;">
                    El acceso es válido por 48 horas.
                  </span>
                </td>
              </tr>

              <!-- Divisor -->
              <tr>
                <td style="border-top:1px solid #B5D4F4;padding-top:20px;padding-bottom:0;font-size:0;line-height:0;">&nbsp;</td>
              </tr>

              <!-- Soporte -->
              <tr>
                <td style="padding-top:4px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="36" style="vertical-align:top;padding-right:12px;padding-top:2px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" width="30" height="30"
                              style="background-color:#E6F1FB;border-radius:50%;text-align:center;vertical-align:middle;font-size:14px;line-height:30px;width:30px;height:30px;">
                              ℹ️
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="vertical-align:middle;">
                        <p style="margin:0;font-size:13px;color:#777777;font-family:Arial,Helvetica,sans-serif;line-height:1.65;">
                          ¿Tienes alguna pregunta? Escríbenos a
                          <a href="mailto:soporte@todonto.com" style="color:#185FA5;text-decoration:none;font-weight:bold;">
                            soporte@todonto.com
                          </a>
                          — te respondemos en menos de 24 horas con gusto.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td class="email-footer" align="center"
            style="background-color:#042C53;padding:24px 40px;border-radius:0 0 14px 14px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <span style="color:rgba(255,255,255,0.55);font-size:13px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                    🦷 Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:rgba(255,255,255,0.35);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    &copy; 2026 Todonto &middot; Todos los derechos reservados
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.22);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    Si no creaste esta cuenta, puedes ignorar este correo con seguridad.
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>
  `;

  await sendEmail(to, subject, html);
}

/**
 * Envía un correo de confirmación de suscripción
 * @param to - Correo del usuario
 * @param username - Nombre del usuario
 * @param plan - Nombre del plan (ej. "Mensual", "Anual", "Prueba")
 * @param price - Precio pagado (puede ser 0 para periodo de prueba)
 * @param currency - Moneda (ej. "MXN")
 * @param startDate - Fecha de inicio
 * @param endDate - Fecha de fin (o null si es perpetua)
 * @param isTrial - Indica si es un periodo de prueba gratuito
 */
export async function sendSubscriptionEmail(
    to: string,
    username: string,
    plan: string,
    price: number,
    currency: string,
    startDate: Date,
    endDate: Date | null,
    isTrial: boolean = false
) {
    const subject = isTrial
        ? '🎉 ¡Tu periodo de prueba en Todonto ha comenzado!'
        : '¡Gracias por tu suscripción a Todonto! 🎉';

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const startFormatted = formatDate(startDate);
    const endFormatted = endDate ? formatDate(endDate) : 'Nunca (suscripción de por vida)';

    const priceFormatted = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(price);

    // Determinar ciclo de facturación según el nombre del plan
    let billingCycle = '';
    if (plan.toLowerCase().includes('mensual')) billingCycle = 'mes';
    else if (plan.toLowerCase().includes('anual')) billingCycle = 'año';
    else if (plan.toLowerCase().includes('prueba')) billingCycle = 'mes';
    else billingCycle = 'período contratado';

    // Texto adicional para periodo de prueba
    let trialWarning = '';
    if (isTrial) {
        trialWarning = `
            <div style="background-color:#FFF3E0; padding:14px 18px; border-radius:8px; margin:20px 0;">
                <p style="margin:0; font-size:13px; color:#E65100;">
                    <strong>⚠️ Importante:</strong> Tu periodo de prueba finaliza el <strong>${endFormatted}</strong>. Al término, se realizará automáticamente el cobro del plan mensual ($399.00MXN) a menos que cancele antes.
                </p>
            </div>
        `;
    }

    const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${isTrial ? 'Comienza tu prueba' : 'Confirmación de suscripción'} - Todonto</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f0f4f8; }

    @media only screen and (max-width: 600px) {
      .email-wrapper  { width: 100% !important; }
      .email-header   { padding: 28px 20px !important; }
      .email-body     { padding: 24px 20px !important; }
      .email-footer   { padding: 20px !important; }
      .feature-inner  { padding: 14px !important; }
      .cta-btn        { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">

<div style="display:none;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${isTrial ? 'Activa tu prueba gratuita por 7 días.' : 'Confirma los detalles de tu plan y la facturación automática.'}
</div>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0f4f8;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table class="email-wrapper" role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">

        <!-- ===== HEADER ===== -->
        <tr>
          <td class="email-header" align="center"
            style="background-color:#185FA5;padding:36px 40px 30px;border-radius:14px 14px 0 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" width="54" height="54"
                        style="background-color:#0C447C;border-radius:14px;text-align:center;vertical-align:middle;font-size:26px;line-height:54px;width:54px;height:54px;">
                        🦷
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:#ffffff;font-size:24px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">
                    Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.6);font-size:11px;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    ${isTrial ? 'Prueba gratuita' : 'Suscripción activa'}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== BODY ===== -->
        <tr>
          <td class="email-body"
            style="background-color:#ffffff;padding:36px 40px;border-left:1px solid #B5D4F4;border-right:1px solid #B5D4F4;">

            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Saludo -->
              <tr>
                <td style="padding-bottom:8px;">
                  <span style="font-size:22px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">
                    ¡Hola, ${username}! 👋
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <p style="margin:0;font-size:15px;color:#555555;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">
                    ${isTrial
                        ? 'Tu periodo de prueba gratuito ha comenzado. Disfruta de todas las ventajas de Todonto durante 7 días.'
                        : '¡Felicidades! Tu suscripción a <strong style="color:#185FA5;">Todonto</strong> ha sido activada exitosamente.'}
                  </p>
                </td>
              </tr>

              <!-- Divisor bicolor -->
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="35%" height="3" style="background-color:#185FA5;font-size:0;line-height:0;">&nbsp;</td>
                      <td width="65%" height="3" style="background-color:#B5D4F4;font-size:0;line-height:0;">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Etiqueta sección -->
              <tr>
                <td style="padding-bottom:14px;">
                  <span style="font-size:11px;font-weight:bold;color:#185FA5;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Detalles de tu plan
                  </span>
                </td>
              </tr>

              <!-- Detalles del plan (estilo feature) -->
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    📋
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;">Plan contratado</p>
                              <p style="margin:0;font-size:13px;color:#185FA5;">${plan}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Monto y fechas -->
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    💰
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;">Monto</p>
                              <p style="margin:0;font-size:13px;color:#185FA5;">${priceFormatted} (${currency})</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    📅
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;">Fecha de inicio</p>
                              <p style="margin:0;font-size:13px;color:#185FA5;">${startFormatted}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding-bottom:20px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    ⏳
                                  </td>
                                <tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;">Fecha de expiración</p>
                              <p style="margin:0;font-size:13px;color:#185FA5;">${endFormatted}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Advertencia de prueba -->
              ${trialWarning}

              <!-- Información legal y facturación -->
              <tr>
                <td style="padding-bottom:20px;">
                  <div style="background-color:#F9F9F9; padding:14px 18px; border-radius:8px; border:1px solid #E0E0E0;">
                    <p style="margin:0 0 8px; font-size:13px; color:#555;">
                      <strong>🔁 Facturación automática:</strong> Tu suscripción se renovará automáticamente cada <strong>${billingCycle}</strong> utilizando el método de pago que proporcionaste. Recibirás un recibo por cada cargo.
                    </p>
                    <p style="margin:0; font-size:13px; color:#555;">
                      <strong>Cancelación:</strong> Puedes cancelar en cualquier momento desde tu perfil. Al cancelar, no se realizarán cargos futuros y seguirás teniendo acceso hasta la fecha de expiración.
                      <br/>
                      <a href="${process.env.FRONTEND_URL}/perfil/cancelar-suscripcion" style="color:#185FA5; text-decoration:underline;">Cancelar suscripción →</a>
                    </p>
                  </div>
                </td>
              </tr>

              <!-- CTA Botón principal -->
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="background-color:#185FA5;border-radius:10px;">
                        <a href="${process.env.FRONTEND_URL}/dashboard" target="_blank"
                          style="display:inline-block;background-color:#185FA5;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;padding:15px 40px;border-radius:10px;text-align:center;">
                          Ir a mi cuenta &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Divisor -->
              <tr>
                <td style="border-top:1px solid #B5D4F4;padding-top:20px;padding-bottom:0;font-size:0;line-height:0;">&nbsp;</td>
              </tr>

              <!-- Soporte y términos -->
              <tr>
                <td style="padding-top:4px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="36" style="vertical-align:top;padding-right:12px;padding-top:2px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" width="30" height="30"
                              style="background-color:#E6F1FB;border-radius:50%;text-align:center;vertical-align:middle;font-size:14px;line-height:30px;width:30px;height:30px;">
                              ℹ️
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="vertical-align:middle;">
                        <p style="margin:0;font-size:13px;color:#777777;font-family:Arial,Helvetica,sans-serif;line-height:1.65;">
                          ¿Tienes alguna pregunta? Escríbenos a
                          <a href="mailto:soporte@todonto.com" style="color:#185FA5;text-decoration:none;font-weight:bold;">
                            soporte@todonto.com
                          </a>
                          — te respondemos en menos de 24 horas.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding-top:12px;">
                  <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">
                    Al suscribirte, aceptas nuestros 
                    <a href="${process.env.FRONTEND_URL}/terminos" style="color:#185FA5;text-decoration:underline;">Términos y Condiciones</a> 
                    y 
                    <a href="${process.env.FRONTEND_URL}/privacidad" style="color:#185FA5;text-decoration:underline;">Aviso de Privacidad</a>.
                    Los cargos se procesarán automáticamente según el ciclo seleccionado. Puedes cancelar en cualquier momento desde tu perfil.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td class="email-footer" align="center"
            style="background-color:#042C53;padding:24px 40px;border-radius:0 0 14px 14px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <span style="color:rgba(255,255,255,0.55);font-size:13px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                    🦷 Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:rgba(255,255,255,0.35);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    &copy; 2026 Todonto · Todos los derechos reservados
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.22);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    ${isTrial ? 'Al finalizar la prueba se cobrará el plan mensual automáticamente.' : 'Recibirás un recibo por cada cargo.'}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

    await sendEmail(to, subject, html);
}

/**
 * Envía un correo para confirmar la cancelación del plan actual
 * @param to - Correo del usuario
 * @param username - Nombre del usuario
 * @param plan - Nombre del plan de prueba (ej. "Prueba gratuita")
 * @param endDate - Fecha final del plan
 */
export async function sendCancellationEmail(
    to: string,
    username: string,
    plan: string,
    endDate: Date | null
) {
    const subject = 'Lamentamos que te vayas – Todonto';

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const endFormatted = endDate ? formatDate(endDate) : 'de inmediato';

    const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cancelación de suscripción - Todonto</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f0f4f8; }

    @media only screen and (max-width: 600px) {
      .email-wrapper  { width: 100% !important; }
      .email-header   { padding: 28px 20px !important; }
      .email-body     { padding: 24px 20px !important; }
      .email-footer   { padding: 20px !important; }
      .feature-inner  { padding: 14px !important; }
      .cta-btn        { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">

<!-- Preheader oculto -->
<div style="display:none;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Tu suscripción ha sido cancelada. Todavía puedes acceder hasta ${endFormatted}.
</div>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0f4f8;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table class="email-wrapper" role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">

        <!-- ===== HEADER ===== -->
        <tr>
          <td class="email-header" align="center"
            style="background-color:#185FA5;padding:36px 40px 30px;border-radius:14px 14px 0 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" width="54" height="54"
                        style="background-color:#0C447C;border-radius:14px;text-align:center;vertical-align:middle;font-size:26px;line-height:54px;width:54px;height:54px;">
                        🦷
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:#ffffff;font-size:24px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">
                    Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.6);font-size:11px;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Cancelación de suscripción
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== BODY ===== -->
        <tr>
          <td class="email-body"
            style="background-color:#ffffff;padding:36px 40px;border-left:1px solid #B5D4F4;border-right:1px solid #B5D4F4;">

            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Saludo -->
              <tr>
                <td style="padding-bottom:8px;">
                  <span style="font-size:22px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">
                    ¡Hola, ${username}! 👋
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <p style="margin:0;font-size:15px;color:#555555;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">
                    Lamentamos que hayas decidido cancelar tu suscripción al plan <strong style="color:#185FA5;">${plan}</strong>. Tu acceso continuará activo hasta <strong>${endFormatted}</strong>.
                  </p>
                </td>
              </tr>

              <!-- Divisor bicolor -->
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="35%" height="3" style="background-color:#185FA5;font-size:0;line-height:0;">&nbsp;</td>
                      <td width="65%" height="3" style="background-color:#B5D4F4;font-size:0;line-height:0;">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Etiqueta sección -->
              <tr>
                <td style="padding-bottom:14px;">
                  <span style="font-size:11px;font-weight:bold;color:#185FA5;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Detalles de la cancelación
                  </span>
                </td>
              </tr>

              <!-- Feature: Plan cancelado -->
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    📋
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;">
                                Plan cancelado
                              </p>
                              <p style="margin:0;font-size:13px;color:#185FA5;font-family:Arial,Helvetica,sans-serif;line-height:1.55;">
                                ${plan}
                              </p>
                            </td>
                          </tr>
                        </tr>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Feature: Acceso vigente hasta -->
              <tr>
                <td style="padding-bottom:20px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    ⏳
                                  </td>
                                </tr>
                              <tr>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;">
                                Acceso vigente hasta
                              </p>
                              <p style="margin:0;font-size:13px;color:#185FA5;font-family:Arial,Helvetica,sans-serif;line-height:1.55;">
                                ${endFormatted}
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Feedback -->
              <tr>
                <td style="padding-bottom:30px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#FFF3E0;border-radius:10px;border-left:3px solid #FF9800;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#FF9800;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    💬
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#E65100;font-family:Arial,Helvetica,sans-serif;">
                                ¿Fue algo que pudimos mejorar?
                              </p>
                              <p style="margin:0;font-size:13px;color:#E65100;font-family:Arial,Helvetica,sans-serif;line-height:1.55;">
                                <a href="${process.env.FRONTEND_URL}/feedback" style="color:#185FA5;text-decoration:underline;">Cuéntanos tu opinión</a> para seguir creciendo.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Mensaje de regreso -->
              <tr>
                <td style="padding-bottom:30px;">
                  <p style="margin:0;font-size:15px;color:#555555;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">
                    Recuerda que <strong style="color:#185FA5;">siempre serás bienvenido de regreso</strong>. Puedes volver a suscribirte en cualquier momento y recuperar todos los beneficios de Todonto.
                  </p>
                </td>
              </tr>

              <!-- CTA -->
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <!--[if mso]>
                  <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                    href="${process.env.FRONTEND_URL}/suscripciones" style="height:50px;v-text-anchor:middle;width:220px;" arcsize="20%"
                    fillcolor="#4CAF50" strokecolor="#4CAF50">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;">
                      Volver a suscribirme &rarr;
                    </center>
                  </v:roundrect>
                  <![endif]-->
                  <!--[if !mso]><!-->
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="background-color:#4CAF50;border-radius:10px;">
                        <a class="cta-btn" href="${process.env.FRONTEND_URL}/suscripciones" target="_blank"
                          style="display:inline-block;background-color:#4CAF50;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;padding:15px 40px;border-radius:10px;text-align:center;">
                          Volver a suscribirme &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                  <!--<![endif]-->
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:28px;">
                  <span style="font-size:12px;color:#aaaaaa;font-family:Arial,Helvetica,sans-serif;">
                    Puedes regresar cuando quieras.
                  </span>
                </td>
              </tr>

              <!-- Divisor -->
              <tr>
                <td style="border-top:1px solid #B5D4F4;padding-top:20px;padding-bottom:0;font-size:0;line-height:0;">&nbsp;</td>
              </tr>

              <!-- Soporte -->
              <tr>
                <td style="padding-top:4px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="36" style="vertical-align:top;padding-right:12px;padding-top:2px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" width="30" height="30"
                              style="background-color:#E6F1FB;border-radius:50%;text-align:center;vertical-align:middle;font-size:14px;line-height:30px;width:30px;height:30px;">
                              ℹ️
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="vertical-align:middle;">
                        <p style="margin:0;font-size:13px;color:#777777;font-family:Arial,Helvetica,sans-serif;line-height:1.65;">
                          ¿Tienes alguna pregunta? Escríbenos a
                          <a href="mailto:soporte@todonto.com" style="color:#185FA5;text-decoration:none;font-weight:bold;">
                            soporte@todonto.com
                          </a>
                          — te responderemos en menos de 24 horas con gusto.
                        </p>
                      </td>
                    </tr>
                  <tr>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td class="email-footer" align="center"
            style="background-color:#042C53;padding:24px 40px;border-radius:0 0 14px 14px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <span style="color:rgba(255,255,255,0.55);font-size:13px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                    🦷 Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:rgba(255,255,255,0.35);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    &copy; 2026 Todonto &middot; Todos los derechos reservados
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.22);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    Si no solicitaste esta cancelación, contacta a soporte.
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </table>
</table>

</body>
</html>`;

    await sendEmail(to, subject, html);
}

/**
 * Envía un recordatorio de que el periodo de prueba está por terminar
 * @param to - Correo del usuario
 * @param username - Nombre del usuario
 * @param planName - Nombre del plan de prueba (ej. "Prueba de 7 días")
 * @param trialEndDate - Fecha exacta en que termina la prueba
 * @param priceToCharge - Precio que se cobrará al renovar (ej. 399)
 * @param currency - Moneda (ej. "MXN")
 * @param last4 - Últimos 4 dígitos de la tarjeta registrada (opcional)
 */
export async function sendTrialEndingReminderEmail(
    to: string,
    username: string,
    planName: string,
    trialEndDate: Date,
    priceToCharge: number,
    currency: string,
    last4?: string
) {
    const subject = `⚠️ Tu prueba de Todonto termina mañana - Acción requerida`;

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const endFormatted = formatDate(trialEndDate);
    const priceFormatted = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(priceToCharge);

    const paymentMethodText = last4 
        ? `Se realizará un cargo de <strong>${priceFormatted}</strong> a tu tarjeta terminada en <strong>**** **** **** ${last4}</strong>.`
        : `Se realizará un cargo de <strong>${priceFormatted}</strong> a tu método de pago registrado.`;

    const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tu prueba termina mañana - Todonto</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f0f4f8; }

    @media only screen and (max-width: 600px) {
      .email-wrapper  { width: 100% !important; }
      .email-header   { padding: 28px 20px !important; }
      .email-body     { padding: 24px 20px !important; }
      .email-footer   { padding: 20px !important; }
      .feature-inner  { padding: 14px !important; }
      .cta-btn        { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">

<div style="display:none;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Tu periodo de prueba gratuito en Todonto finaliza mañana. Cancela antes para evitar el cargo automático.
</div>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0f4f8;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table class="email-wrapper" role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">

        <!-- ===== HEADER ===== -->
        <tr>
          <td class="email-header" align="center"
            style="background-color:#185FA5;padding:36px 40px 30px;border-radius:14px 14px 0 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" width="54" height="54"
                        style="background-color:#0C447C;border-radius:14px;text-align:center;vertical-align:middle;font-size:26px;line-height:54px;width:54px;height:54px;">
                        🦷
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:#ffffff;font-size:24px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">
                    Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.6);font-size:11px;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Recordatorio de fin de prueba
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== BODY ===== -->
        <tr>
          <td class="email-body"
            style="background-color:#ffffff;padding:36px 40px;border-left:1px solid #B5D4F4;border-right:1px solid #B5D4F4;">

            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Saludo -->
              <tr>
                <td style="padding-bottom:8px;">
                  <span style="font-size:22px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">
                    ¡Hola, ${username}! 👋
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <p style="margin:0;font-size:15px;color:#555555;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">
                    Tu periodo de prueba gratuito finaliza <strong>mañana, ${endFormatted}</strong>.
                    Te recordamos que, al término de la prueba, tu suscripción se renovará automáticamente al plan mensual.
                  </p>
                </td>
              </tr>

              <!-- Divisor bicolor -->
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="35%" height="3" style="background-color:#185FA5;font-size:0;line-height:0;">&nbsp;</td>
                      <td width="65%" height="3" style="background-color:#B5D4F4;font-size:0;line-height:0;">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Etiqueta sección -->
              <tr>
                <td style="padding-bottom:14px;">
                  <span style="font-size:11px;font-weight:bold;color:#185FA5;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Detalles de tu cuenta
                  </span>
                </td>
              </tr>

              <!-- Plan actual (prueba) -->
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    📋
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;">Plan actual</p>
                              <p style="margin:0;font-size:13px;color:#185FA5;">${planName}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Fecha de fin de prueba -->
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    ⏳
                                  </td>
                                <tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;">Fecha de expiración de la prueba</p>
                              <p style="margin:0;font-size:13px;color:#185FA5;">${endFormatted}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Próximo cargo -->
              <tr>
                <td style="padding-bottom:20px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    💳
                                  </td>
                                <tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;">Próximo cargo</p>
                              <p style="margin:0;font-size:13px;color:#185FA5;">${priceFormatted} (mensual)</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- ADVERTENCIA PRINCIPAL -->
              <tr>
                <td style="padding-bottom:20px;">
                  <div style="background-color:#FFF3E0; padding:18px 20px; border-radius:10px; border-left:5px solid #E65100;">
                    <p style="margin:0 0 8px; font-size:15px; font-weight:bold; color:#E65100;">
                      ⚠️ Acción requerida antes de mañana
                    </p>
                    <p style="margin:0; font-size:14px; color:#555; line-height:1.6;">
                      ${paymentMethodText}<br/>
                      <strong>Este cargo se procesará automáticamente al finalizar el ${endFormatted}.</strong>
                    </p>
                  </div>
                </td>
              </tr>

              <!-- Opciones de cancelación -->
              <tr>
                <td style="padding-bottom:20px;">
                  <div style="background-color:#F9F9F9; padding:16px 20px; border-radius:8px; border:1px solid #E0E0E0;">
                    <p style="margin:0 0 8px; font-size:14px; color:#0C447C; font-weight:bold;">
                      ¿No deseas continuar?
                    </p>
                    <p style="margin:0 0 12px; font-size:13px; color:#555;">
                      Puedes cancelar tu suscripción en cualquier momento desde tu perfil y no se realizará ningún cargo.
                    </p>
                    <p style="margin:0;">
                      <a href="${process.env.FRONTEND_URL}/perfil/cancelar-suscripcion" style="color:#185FA5; font-weight:bold; text-decoration:underline;">
                        Cancelar suscripción →
                      </a>
                    </p>
                  </div>
                </td>
              </tr>

              <!-- Información legal adicional -->
              <tr>
                <td style="padding-bottom:20px;">
                  <p style="margin:0; font-size:12px; color:#777; line-height:1.5;">
                    Al mantener activa tu suscripción, aceptas nuestros 
                    <a href="${process.env.FRONTEND_URL}/terminos" style="color:#185FA5;text-decoration:underline;">Términos y Condiciones</a> 
                    y el cobro recurrente mensual. Recibirás un comprobante por cada cargo realizado.
                  </p>
                </td>
              </tr>

              <!-- CTA Botón principal -->
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="background-color:#185FA5;border-radius:10px;">
                        <a href="${process.env.FRONTEND_URL}/dashboard" target="_blank"
                          style="display:inline-block;background-color:#185FA5;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;padding:15px 40px;border-radius:10px;text-align:center;">
                          Administrar mi cuenta &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Divisor -->
              <tr>
                <td style="border-top:1px solid #B5D4F4;padding-top:20px;padding-bottom:0;font-size:0;line-height:0;">&nbsp;</td>
              </tr>

              <!-- Soporte -->
              <tr>
                <td style="padding-top:4px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="36" style="vertical-align:top;padding-right:12px;padding-top:2px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" width="30" height="30"
                              style="background-color:#E6F1FB;border-radius:50%;text-align:center;vertical-align:middle;font-size:14px;line-height:30px;width:30px;height:30px;">
                              ℹ️
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="vertical-align:middle;">
                        <p style="margin:0;font-size:13px;color:#777777;font-family:Arial,Helvetica,sans-serif;line-height:1.65;">
                          Si tienes dudas sobre tu facturación, escríbenos a
                          <a href="mailto:soporte@todonto.com" style="color:#185FA5;text-decoration:none;font-weight:bold;">
                            soporte@todonto.com
                          </a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td class="email-footer" align="center"
            style="background-color:#042C53;padding:24px 40px;border-radius:0 0 14px 14px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <span style="color:rgba(255,255,255,0.55);font-size:13px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                    🦷 Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:rgba(255,255,255,0.35);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    &copy; 2026 Todonto · Todos los derechos reservados
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.22);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    Este es un recordatorio automático. Para cancelar, accede a tu perfil.
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

    await sendEmail(to, subject, html);
}

/**
 * Envía un código de verificación de 6 dígitos (para verificación de correo.)
 * @param to - Correo electrónico del destinatario
 * @param code - Código de 6 dígitos
 * @param username - Nombre del usuario (opcional)
 */
export async function sendCodeVerificationEmail(to: string, code: string, username?: string) {
    const subject = '🔐 Código de verificación - Todonto';

    const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verifica tu correo - Todonto</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f0f4f8; }

    @media only screen and (max-width: 600px) {
      .email-wrapper  { width: 100% !important; }
      .email-header   { padding: 28px 20px !important; }
      .email-body     { padding: 24px 20px !important; }
      .email-footer   { padding: 20px !important; }
      .feature-inner  { padding: 14px !important; }
      .cta-btn        { display: block !important; text-align: center !important; }
      .code-block     { font-size: 28px !important; letter-spacing: 4px !important; padding: 12px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">

<!-- Preheader oculto -->
<div style="display:none;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Usa este código para verificar tu dirección de correo.
</div>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0f4f8;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table class="email-wrapper" role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">

        <!-- ===== HEADER ===== -->
        <tr>
          <td class="email-header" align="center"
            style="background-color:#185FA5;padding:36px 40px 30px;border-radius:14px 14px 0 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" width="54" height="54"
                        style="background-color:#0C447C;border-radius:14px;text-align:center;vertical-align:middle;font-size:26px;line-height:54px;width:54px;height:54px;">
                        ✉️
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:#ffffff;font-size:24px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">
                    Verifica tu correo
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.6);font-size:11px;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Todonto · Seguridad de tu cuenta
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== BODY ===== -->
        <tr>
          <td class="email-body"
            style="background-color:#ffffff;padding:36px 40px;border-left:1px solid #B5D4F4;border-right:1px solid #B5D4F4;">

            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Saludo -->
              <tr>
                <td style="padding-bottom:8px;">
                  <span style="font-size:22px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">
                    ${username ? `¡Hola, ${username}! 👋` : '¡Hola! 👋'}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <p style="margin:0;font-size:15px;color:#555555;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">
                    Para confirmar tu dirección de correo electrónico y activar tu cuenta en <strong style="color:#185FA5;">Todonto</strong>, utiliza el siguiente código de verificación.
                  </p>
                </td>
              </tr>

              <!-- Divisor bicolor -->
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="35%" height="3" style="background-color:#185FA5;font-size:0;line-height:0;">&nbsp;</td>
                      <td width="65%" height="3" style="background-color:#B5D4F4;font-size:0;line-height:0;">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Etiqueta sección -->
              <tr>
                <td style="padding-bottom:14px;">
                  <span style="font-size:11px;font-weight:bold;color:#185FA5;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Tu código de seguridad
                  </span>
                </td>
              </tr>

              <!-- Bloque del código -->
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:14px;border-left:4px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:20px 24px;text-align:center;">
                        <span class="code-block" style="font-size:38px;font-weight:bold;letter-spacing:6px;color:#0C447C;font-family:monospace;display:inline-block;background-color:#ffffff;padding:16px 24px;border-radius:12px;border:1px solid #B5D4F4;">
                          ${code}
                        </span>
                        <p style="margin:16px 0 0 0;font-size:13px;color:#185FA5;font-family:Arial,Helvetica,sans-serif;">
                          Este código expira en <strong>10 minutos</strong>.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Instrucciones -->
              <tr>
                <td style="padding-bottom:30px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#F4F9FF;border-radius:10px;">
                    <tr>
                      <td class="feature-inner" style="padding:18px 20px;">
                        <p style="margin:0 0 8px 0;font-size:14px;font-weight:bold;color:#0C447C;">
                          🔍 ¿Cómo usar este código?
                        </p>
                        <p style="margin:0;font-size:13px;color:#555555;line-height:1.55;">
                          1. Ingresa el código en la pantalla de verificación de Todonto.<br/>
                          2. Una vez verificado, tu cuenta quedará completamente activa.<br/>
                          3. Si no solicitaste este cambio, ignora este correo.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Divisor -->
              <tr>
                <td style="border-top:1px solid #B5D4F4;padding-top:20px;padding-bottom:0;font-size:0;line-height:0;">&nbsp;</td>
              </tr>

              <!-- Soporte -->
              <tr>
                <td style="padding-top:4px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="36" style="vertical-align:top;padding-right:12px;padding-top:2px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" width="30" height="30"
                              style="background-color:#E6F1FB;border-radius:50%;text-align:center;vertical-align:middle;font-size:14px;line-height:30px;width:30px;height:30px;">
                              ℹ️
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="vertical-align:middle;">
                        <p style="margin:0;font-size:13px;color:#777777;font-family:Arial,Helvetica,sans-serif;line-height:1.65;">
                          ¿No recibiste el código? Revisa tu bandeja de spam o contacta a
                          <a href="mailto:soporte@todonto.com" style="color:#185FA5;text-decoration:none;font-weight:bold;">
                            soporte@todonto.com
                          </a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td class="email-footer" align="center"
            style="background-color:#042C53;padding:24px 40px;border-radius:0 0 14px 14px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <span style="color:rgba(255,255,255,0.55);font-size:13px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                    🦷 Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:rgba(255,255,255,0.35);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    &copy; 2026 Todonto · Todos los derechos reservados
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.22);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    Este es un mensaje automático, por favor no responder.
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;

    await sendEmail(to, subject, html);
}

/**
 * Envía un correo con un código de 6 dígitos para restablecer la contraseña
 * @param to - Correo del destinatario
 * @param username - Nombre del usuario
 * @param code - Código de 6 dígitos
 */
export async function sendPasswordResetCode(to: string, username: string, code: string) {
    const subject = '🔐 Código para restablecer tu contraseña - Todonto';

    const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Restablecer contraseña - Todonto</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f0f4f8; }

    @media only screen and (max-width: 600px) {
      .email-wrapper  { width: 100% !important; }
      .email-header   { padding: 28px 20px !important; }
      .email-body     { padding: 24px 20px !important; }
      .email-footer   { padding: 20px !important; }
      .feature-inner  { padding: 14px !important; }
      .code-box       { font-size: 36px !important; letter-spacing: 8px !important; }
      .cta-btn        { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">

<div style="display:none;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Usa el código de 6 dígitos para restablecer tu contraseña. Válido por 10 minutos.
</div>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0f4f8;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table class="email-wrapper" role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">

        <!-- ===== HEADER ===== -->
        <tr>
          <td class="email-header" align="center"
            style="background-color:#185FA5;padding:36px 40px 30px;border-radius:14px 14px 0 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" width="54" height="54"
                        style="background-color:#0C447C;border-radius:14px;text-align:center;vertical-align:middle;font-size:26px;line-height:54px;width:54px;height:54px;">
                        🦷
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:#ffffff;font-size:24px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">
                    Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.6);font-size:11px;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Recuperación de contraseña
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== BODY ===== -->
        <tr>
          <td class="email-body"
            style="background-color:#ffffff;padding:36px 40px;border-left:1px solid #B5D4F4;border-right:1px solid #B5D4F4;">

            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Saludo -->
              <tr>
                <td style="padding-bottom:8px;">
                  <span style="font-size:22px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">
                    ¡Hola, ${username}! 👋
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <p style="margin:0;font-size:15px;color:#555555;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">
                    Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong style="color:#185FA5;">Todonto</strong>.
                    Para continuar, utiliza el siguiente código de verificación de 6 dígitos:
                  </p>
                </td>
              </tr>

              <!-- Divisor bicolor -->
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="35%" height="3" style="background-color:#185FA5;font-size:0;line-height:0;">&nbsp;</td>
                      <td width="65%" height="3" style="background-color:#B5D4F4;font-size:0;line-height:0;">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Código de verificación destacado -->
              <tr>
                <td align="center" style="padding-bottom:20px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                    <tr>
                      <td align="center" style="background-color:#E6F1FB; padding:28px 40px; border-radius:16px; border:2px dashed #185FA5;">
                        <span style="font-size:12px; color:#185FA5; letter-spacing:1.5px; text-transform:uppercase; display:block; margin-bottom:12px; font-weight:bold;">
                          Tu código de verificación
                        </span>
                        <span class="code-box" style="font-size:48px; font-weight:bold; color:#0C447C; letter-spacing:12px; font-family:'Courier New', monospace;">
                          ${code}
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Información de expiración y uso -->
              <tr>
                <td style="padding-bottom:20px;">
                  <div style="background-color:#FFF3E0; padding:14px 18px; border-radius:8px; border-left:4px solid #E65100;">
                    <p style="margin:0; font-size:13px; color:#E65100;">
                      <strong>⏳ Importante:</strong> Este código es válido por <strong>10 minutos</strong>. Si no lo utilizas en ese tiempo, deberás solicitar uno nuevo.
                    </p>
                  </div>
                </td>
              </tr>

              <!-- Instrucciones adicionales -->
              <tr>
                <td style="padding-bottom:20px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    📝
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;">¿Cómo usarlo?</p>
                              <p style="margin:0;font-size:13px;color:#185FA5;">
                                Ingresa este código en la página de restablecimiento que aparece en tu navegador.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Advertencia de seguridad -->
              <tr>
                <td style="padding-bottom:20px;">
                  <div style="background-color:#F9F9F9; padding:14px 18px; border-radius:8px; border:1px solid #E0E0E0;">
                    <p style="margin:0; font-size:13px; color:#555;">
                      <strong>🔒 Seguridad:</strong> Si no solicitaste restablecer tu contraseña, puedes ignorar este mensaje. Nadie más podrá acceder a tu cuenta sin este código.
                    </p>
                  </div>
                </td>
              </tr>

              <!-- Botón para ir a restablecer (opcional, depende de flujo) -->
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="background-color:#185FA5;border-radius:10px;">
                        <a href="${process.env.FRONTEND_URL}/restablecer-contrasena" target="_blank"
                          style="display:inline-block;background-color:#185FA5;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;padding:15px 40px;border-radius:10px;text-align:center;">
                          Ir a restablecer contraseña &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Divisor -->
              <tr>
                <td style="border-top:1px solid #B5D4F4;padding-top:20px;padding-bottom:0;font-size:0;line-height:0;">&nbsp;</td>
              </tr>

              <!-- Soporte -->
              <tr>
                <td style="padding-top:4px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="36" style="vertical-align:top;padding-right:12px;padding-top:2px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" width="30" height="30"
                              style="background-color:#E6F1FB;border-radius:50%;text-align:center;vertical-align:middle;font-size:14px;line-height:30px;width:30px;height:30px;">
                              ℹ️
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="vertical-align:middle;">
                        <p style="margin:0;font-size:13px;color:#777777;font-family:Arial,Helvetica,sans-serif;line-height:1.65;">
                          ¿Problemas con el código? Escríbenos a
                          <a href="mailto:soporte@todonto.com" style="color:#185FA5;text-decoration:none;font-weight:bold;">
                            soporte@todonto.com
                          </a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding-top:12px;">
                  <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">
                    Recuerda que nunca compartiremos tu contraseña por correo electrónico. 
                    <a href="${process.env.FRONTEND_URL}/terminos" style="color:#185FA5;text-decoration:underline;">Términos y Condiciones</a> 
                    y 
                    <a href="${process.env.FRONTEND_URL}/privacidad" style="color:#185FA5;text-decoration:underline;">Aviso de Privacidad</a>.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td class="email-footer" align="center"
            style="background-color:#042C53;padding:24px 40px;border-radius:0 0 14px 14px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <span style="color:rgba(255,255,255,0.55);font-size:13px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                    🦷 Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:rgba(255,255,255,0.35);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    &copy; 2026 Todonto · Todos los derechos reservados
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.22);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    Este es un mensaje automático, por favor no respondas a este correo.
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

    await sendEmail(to, subject, html);
}

/**
 * Envía una alerta de seguridad por un nuevo inicio de sesión
 * @param to - Correo del usuario
 * @param username - Nombre del usuario
 * @param ip - Dirección IP del inicio de sesión
 * @param userAgent - Agente de usuario (dispositivo/navegador)
 * @param loginTime - Fecha y hora del inicio de sesión
 */
export async function sendSecurityAlertEmail(
    to: string,
    username: string,
    ip: string,
    userAgent: string,
    loginTime: Date,
) {
    const subject = '🔐 Alerta de seguridad: Nuevo inicio de sesión en Todonto';

    const formatDateTime = (date: Date) => {
        return date.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const timeFormatted = formatDateTime(loginTime);
    const device = userAgent.includes('Mobile') ? 'Móvil' : 'Ordenador';
    const browser = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)/)?.[0] || 'Desconocido';

    const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Alerta de seguridad - Todonto</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f0f4f8; }

    @media only screen and (max-width: 600px) {
      .email-wrapper  { width: 100% !important; }
      .email-header   { padding: 28px 20px !important; }
      .email-body     { padding: 24px 20px !important; }
      .email-footer   { padding: 20px !important; }
      .feature-inner  { padding: 14px !important; }
      .cta-btn        { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">

<!-- Preheader oculto -->
<div style="display:none;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Nuevo acceso detectado. Verifica si eres tú.
</div>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0f4f8;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table class="email-wrapper" role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">

        <!-- ===== HEADER (color alerta) ===== -->
        <tr>
          <td class="email-header" align="center"
            style="background-color:#D32F2F;padding:36px 40px 30px;border-radius:14px 14px 0 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" width="54" height="54"
                        style="background-color:#B71C1C;border-radius:14px;text-align:center;vertical-align:middle;font-size:26px;line-height:54px;width:54px;height:54px;">
                        ⚠️
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:#ffffff;font-size:24px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">
                    Alerta de seguridad
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.7);font-size:11px;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Todonto · Protege tu cuenta
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== BODY ===== -->
        <tr>
          <td class="email-body"
            style="background-color:#ffffff;padding:36px 40px;border-left:1px solid #F5C6C6;border-right:1px solid #F5C6C6;">

            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Saludo -->
              <tr>
                <td style="padding-bottom:8px;">
                  <span style="font-size:22px;font-weight:bold;color:#B71C1C;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">
                    ¡Hola, ${username}! 👋
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <p style="margin:0;font-size:15px;color:#555555;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">
                    Hemos detectado un <strong style="color:#D32F2F;">nuevo inicio de sesión</strong> en tu cuenta de <strong style="color:#185FA5;">Todonto</strong>. Si fuiste tú, puedes ignorar este mensaje. Si no, te recomendamos tomar acción de inmediato.
                  </p>
                </td>
              </tr>

              <!-- Divisor bicolor -->
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="35%" height="3" style="background-color:#D32F2F;font-size:0;line-height:0;">&nbsp;</td>
                      <td width="65%" height="3" style="background-color:#F5C6C6;font-size:0;line-height:0;">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Etiqueta sección -->
              <tr>
                <td style="padding-bottom:14px;">
                  <span style="font-size:11px;font-weight:bold;color:#D32F2F;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Detalles del acceso
                  </span>
                </td>
              </tr>

              <!-- Feature: Fecha y hora -->
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#FFF5F5;border-radius:10px;border-left:3px solid #D32F2F;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#D32F2F;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    📅
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#B71C1C;font-family:Arial,Helvetica,sans-serif;">
                                Fecha y hora
                              </p>
                              <p style="margin:0;font-size:13px;color:#555;font-family:Arial,Helvetica,sans-serif;line-height:1.55;">
                                ${timeFormatted}
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Feature: IP -->
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#FFF5F5;border-radius:10px;border-left:3px solid #D32F2F;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#D32F2F;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    🌐
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#B71C1C;font-family:Arial,Helvetica,sans-serif;">
                                Dirección IP
                              </p>
                              <p style="margin:0;font-size:13px;color:#555;font-family:Arial,Helvetica,sans-serif;line-height:1.55;">
                                ${ip}
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Feature: Dispositivo -->
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#FFF5F5;border-radius:10px;border-left:3px solid #D32F2F;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#D32F2F;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    💻
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#B71C1C;font-family:Arial,Helvetica,sans-serif;">
                                Dispositivo y navegador
                              </p>
                              <p style="margin:0;font-size:13px;color:#555;font-family:Arial,Helvetica,sans-serif;line-height:1.55;">
                                ${device} · ${browser}
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Sección de recomendaciones -->
              <tr>
                <td style="padding-bottom:30px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#FFF5F5;border-radius:10px;border-left:3px solid #D32F2F;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#D32F2F;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    🛡️
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#B71C1C;font-family:Arial,Helvetica,sans-serif;">
                                ¿No reconoces esta actividad?
                              </p>
                              <p style="margin:0;font-size:13px;color:#555;font-family:Arial,Helvetica,sans-serif;line-height:1.55;">
                                Alguien más podría estar accediendo a tu cuenta. Te recomendamos:
                              </p>
                              <ul style="margin:8px 0 0 20px;padding:0;font-size:13px;color:#555;">
                                <li>Cambiar tu contraseña inmediatamente</li>
                                <li>Revisar los dispositivos conectados en tu perfil</li>
                                <li>Contactar a soporte si ves actividad sospechosa</li>
                              </ul>
                             </td>
                           </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- CTA Botones -->
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="display:inline-block;">
                    <tr>
                      <td style="width:12px;"></td>
                      <td align="center" style="background-color:#185FA5;border-radius:10px;">
                        <a href="${process.env.FRONTEND_URL}/perfil/seguridad" target="_blank"
                          style="display:inline-block;background-color:#185FA5;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;padding:15px 30px;border-radius:10px;text-align:center;">
                          Ir a seguridad
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:28px;">
                  <span style="font-size:12px;color:#aaaaaa;font-family:Arial,Helvetica,sans-serif;">
                    Si fuiste tú, ignora este mensaje. De lo contrario, actúa de inmediato.
                  </span>
                </td>
              </tr>

              <!-- Divisor -->
              <tr>
                <td style="border-top:1px solid #F5C6C6;padding-top:20px;padding-bottom:0;font-size:0;line-height:0;">&nbsp;</td>
              </tr>

              <!-- Soporte -->
              <tr>
                <td style="padding-top:4px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="36" style="vertical-align:top;padding-right:12px;padding-top:2px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" width="30" height="30"
                              style="background-color:#FFF5F5;border-radius:50%;text-align:center;vertical-align:middle;font-size:14px;line-height:30px;width:30px;height:30px;">
                              ℹ️
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="vertical-align:middle;">
                        <p style="margin:0;font-size:13px;color:#777777;font-family:Arial,Helvetica,sans-serif;line-height:1.65;">
                          ¿Tienes alguna pregunta? Escríbenos a
                          <a href="mailto:soporte@todonto.com" style="color:#185FA5;text-decoration:none;font-weight:bold;">
                            soporte@todonto.com
                          </a>
                          — te respondemos en menos de 24 horas con gusto.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td class="email-footer" align="center"
            style="background-color:#042C53;padding:24px 40px;border-radius:0 0 14px 14px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <span style="color:rgba(255,255,255,0.55);font-size:13px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                    🦷 Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:rgba(255,255,255,0.35);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    &copy; 2026 Todonto · Todos los derechos reservados
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.22);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    Este es un aviso de seguridad automático.
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;

    await sendEmail(to, subject, html);
}

/**
 * Envía una alerta cuando se actualiza información sensible de la cuenta (correo o teléfono)
 * @param to - Correo del usuario (puede ser el nuevo o el antiguo, según contexto)
 * @param username - Nombre del usuario
 * @param changes - Objeto con los cambios realizados { email?: { old, new }, phone?: { old, new } }
 * @param changeDate - Fecha del cambio
 * @param reportLink - Enlace para reportar actividad sospechosa (opcional)
 */
export async function sendAccountUpdateAlert(
    to: string,
    username: string,
    changes: {
        email?: { old: string; new: string };
        phone?: { old: string; new: string };
    },
    changeDate: Date,
    reportLink?: string
) {
    const subject = '⚠️ Alerta de seguridad: Tu información ha sido actualizada - Todonto';

    const formatDateTime = (date: Date) => {
        return date.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const timeFormatted = formatDateTime(changeDate);

    // Construir bloques HTML para cada cambio
    let changesHtml = '';
    if (changes.email) {
        changesHtml += `
            <tr>
                <td style="padding-bottom:16px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                        style="background-color:#FFF3E0;border-radius:10px;border-left:3px solid #E65100;">
                        <tr>
                            <td class="feature-inner" style="padding:16px 18px;">
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td width="52" style="vertical-align:top;padding-right:14px;">
                                            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td align="center" width="38" height="38"
                                                        style="background-color:#E65100;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                                        📧
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                        <td style="vertical-align:top;">
                                            <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#E65100;">Correo electrónico modificado</p>
                                            <p style="margin:0;font-size:13px;color:#555;">
                                                <span style="color:#999;">Anterior:</span> ${changes.email.old}<br/>
                                                <span style="color:#999;">Nuevo:</span> <strong>${changes.email.new}</strong>
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        `;
    }

    if (changes.phone) {
        changesHtml += `
            <tr>
                <td style="padding-bottom:16px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                        style="background-color:#FFF3E0;border-radius:10px;border-left:3px solid #E65100;">
                        <tr>
                            <td class="feature-inner" style="padding:16px 18px;">
                                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td width="52" style="vertical-align:top;padding-right:14px;">
                                            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td align="center" width="38" height="38"
                                                        style="background-color:#E65100;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                                        📱
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                        <td style="vertical-align:top;">
                                            <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#E65100;">Teléfono modificado</p>
                                            <p style="margin:0;font-size:13px;color:#555;">
                                                <span style="color:#999;">Anterior:</span> ${changes.phone.old}<br/>
                                                <span style="color:#999;">Nuevo:</span> <strong>${changes.phone.new}</strong>
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        `;
    }

    const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Alerta de seguridad - Todonto</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f0f4f8; }

    @media only screen and (max-width: 600px) {
      .email-wrapper  { width: 100% !important; }
      .email-header   { padding: 28px 20px !important; }
      .email-body     { padding: 24px 20px !important; }
      .email-footer   { padding: 20px !important; }
      .feature-inner  { padding: 14px !important; }
      .cta-btn        { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">

<div style="display:none;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Tu información de cuenta ha sido modificada. Si no fuiste tú, actúa de inmediato.
</div>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0f4f8;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table class="email-wrapper" role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">

        <!-- ===== HEADER ===== -->
        <tr>
          <td class="email-header" align="center"
            style="background-color:#185FA5;padding:36px 40px 30px;border-radius:14px 14px 0 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" width="54" height="54"
                        style="background-color:#0C447C;border-radius:14px;text-align:center;vertical-align:middle;font-size:26px;line-height:54px;width:54px;height:54px;">
                        🦷
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:#ffffff;font-size:24px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">
                    Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.6);font-size:11px;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Alerta de seguridad
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== BODY ===== -->
        <tr>
          <td class="email-body"
            style="background-color:#ffffff;padding:36px 40px;border-left:1px solid #B5D4F4;border-right:1px solid #B5D4F4;">

            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Saludo -->
              <tr>
                <td style="padding-bottom:8px;">
                  <span style="font-size:22px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">
                    ¡Hola, ${username}! 👋
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <p style="margin:0;font-size:15px;color:#555555;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">
                    Detectamos cambios en la información sensible de tu cuenta de <strong style="color:#185FA5;">Todonto</strong>.
                    La modificación se realizó el <strong>${timeFormatted}</strong>.
                  </p>
                </td>
              </tr>

              <!-- Divisor bicolor -->
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="35%" height="3" style="background-color:#185FA5;font-size:0;line-height:0;">&nbsp;</td>
                      <td width="65%" height="3" style="background-color:#B5D4F4;font-size:0;line-height:0;">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Etiqueta sección -->
              <tr>
                <td style="padding-bottom:14px;">
                  <span style="font-size:11px;font-weight:bold;color:#185FA5;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Detalles de los cambios
                  </span>
                </td>
              </tr>

              <!-- Lista de cambios (dinámica) -->
              ${changesHtml}

              <!-- Mensaje de advertencia principal -->
              <tr>
                <td style="padding-bottom:20px;">
                  <div style="background-color:#FFEBEE; padding:18px 20px; border-radius:10px; border-left:5px solid #D32F2F;">
                    <p style="margin:0 0 8px; font-size:15px; font-weight:bold; color:#D32F2F;">
                      ⚠️ ¿No reconoces esta actividad?
                    </p>
                    <p style="margin:0; font-size:14px; color:#555; line-height:1.6;">
                      Si no realizaste estos cambios, te recomendamos tomar medidas de inmediato para proteger tu cuenta.
                    </p>
                  </div>
                </td>
              </tr>

              <!-- Acciones recomendadas -->
              <tr>
                <td style="padding-bottom:20px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    🔒
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#0C447C;">Pasos recomendados:</p>
                              <ul style="margin:0;padding-left:20px;font-size:13px;color:#185FA5;">
                                <li style="margin-bottom:6px;">Cambia tu contraseña de inmediato</li>
                                <li style="margin-bottom:6px;">Revisa los dispositivos conectados en tu perfil</li>
                                <li>Contacta a soporte si necesitas ayuda</li>
                              </ul>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Botones de acción -->
              <tr>
                <td align="center" style="padding-bottom:20px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      ${reportLink ? `
                      <td width="48%" align="center" style="padding-right:2%;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td align="center" style="background-color:#D32F2F;border-radius:10px;">
                              <a href="${reportLink}" target="_blank"
                                style="display:inline-block;background-color:#D32F2F;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:14px 10px;border-radius:10px;text-align:center;width:100%;">
                                🚨 Reportar actividad
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                      ` : ''}
                      <td width="${reportLink ? '48%' : '100%'}" align="center">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td align="center" style="background-color:#185FA5;border-radius:10px;">
                              <a href="${process.env.FRONTEND_URL}/perfil/seguridad" target="_blank"
                                style="display:inline-block;background-color:#185FA5;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:14px 10px;border-radius:10px;text-align:center;width:100%;">
                                Ir a seguridad &rarr;
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Información legal -->
              <tr>
                <td style="padding-bottom:20px;">
                  <p style="margin:0;font-size:12px;color:#777;line-height:1.5;">
                    Si fuiste tú quien realizó estos cambios, puedes ignorar este mensaje. 
                    Recuerda que Todonto nunca te pedirá tu contraseña por correo electrónico.
                  </p>
                </td>
              </tr>

              <!-- Divisor -->
              <tr>
                <td style="border-top:1px solid #B5D4F4;padding-top:20px;padding-bottom:0;font-size:0;line-height:0;">&nbsp;</td>
              </tr>

              <!-- Soporte -->
              <tr>
                <td style="padding-top:4px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="36" style="vertical-align:top;padding-right:12px;padding-top:2px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" width="30" height="30"
                              style="background-color:#E6F1FB;border-radius:50%;text-align:center;vertical-align:middle;font-size:14px;line-height:30px;width:30px;height:30px;">
                              ℹ️
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="vertical-align:middle;">
                        <p style="margin:0;font-size:13px;color:#777777;font-family:Arial,Helvetica,sans-serif;line-height:1.65;">
                          ¿Necesitas ayuda? Escríbenos a
                          <a href="mailto:soporte@todonto.com" style="color:#185FA5;text-decoration:none;font-weight:bold;">
                            soporte@todonto.com
                          </a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding-top:12px;">
                  <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">
                    <a href="${process.env.FRONTEND_URL}/terminos" style="color:#185FA5;text-decoration:underline;">Términos y Condiciones</a> 
                    · 
                    <a href="${process.env.FRONTEND_URL}/privacidad" style="color:#185FA5;text-decoration:underline;">Aviso de Privacidad</a>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td class="email-footer" align="center"
            style="background-color:#042C53;padding:24px 40px;border-radius:0 0 14px 14px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <span style="color:rgba(255,255,255,0.55);font-size:13px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                    🦷 Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:rgba(255,255,255,0.35);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    &copy; 2026 Todonto · Todos los derechos reservados
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.22);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    Este es un mensaje automático de seguridad. No respondas a este correo.
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

    await sendEmail(to, subject, html);
}

/**
 * Envía un correo de confirmación de cambio de contraseña exitoso
 * @param to - Correo del usuario
 * @param username - Nombre del usuario
 * @param changeDate - Fecha y hora del cambio
 * @param reportLink - Enlace para reportar actividad sospechosa (opcional)
 */
export async function sendPasswordChangedConfirmation(
    to: string,
    username: string,
    changeDate: Date,
    reportLink?: string
) {
    const subject = '🔒 Confirmación: Tu contraseña ha sido cambiada - Todonto';

    const formatDateTime = (date: Date) => {
        return date.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const timeFormatted = formatDateTime(changeDate);

    const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Contraseña cambiada - Todonto</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f0f4f8; }

    @media only screen and (max-width: 600px) {
      .email-wrapper  { width: 100% !important; }
      .email-header   { padding: 28px 20px !important; }
      .email-body     { padding: 24px 20px !important; }
      .email-footer   { padding: 20px !important; }
      .feature-inner  { padding: 14px !important; }
      .cta-btn        { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">

<div style="display:none;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Tu contraseña de Todonto ha sido actualizada exitosamente.
</div>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0f4f8;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table class="email-wrapper" role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">

        <!-- ===== HEADER ===== -->
        <tr>
          <td class="email-header" align="center"
            style="background-color:#185FA5;padding:36px 40px 30px;border-radius:14px 14px 0 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" width="54" height="54"
                        style="background-color:#0C447C;border-radius:14px;text-align:center;vertical-align:middle;font-size:26px;line-height:54px;width:54px;height:54px;">
                        🦷
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:#ffffff;font-size:24px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">
                    Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.6);font-size:11px;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Seguridad de la cuenta
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== BODY ===== -->
        <tr>
          <td class="email-body"
            style="background-color:#ffffff;padding:36px 40px;border-left:1px solid #B5D4F4;border-right:1px solid #B5D4F4;">

            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Saludo -->
              <tr>
                <td style="padding-bottom:8px;">
                  <span style="font-size:22px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">
                    ¡Hola, ${username}! 👋
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <p style="margin:0;font-size:15px;color:#555555;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">
                    Te confirmamos que la contraseña de tu cuenta en <strong style="color:#185FA5;">Todonto</strong> 
                    ha sido cambiada exitosamente el día <strong>${timeFormatted}</strong>.
                  </p>
                </td>
              </tr>

              <!-- Divisor bicolor -->
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="35%" height="3" style="background-color:#185FA5;font-size:0;line-height:0;">&nbsp;</td>
                      <td width="65%" height="3" style="background-color:#B5D4F4;font-size:0;line-height:0;">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Confirmación de cambio exitoso -->
              <tr>
                <td style="padding-bottom:20px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E8F5E9;border-radius:10px;border-left:3px solid #2E7D32;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#2E7D32;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    ✅
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#2E7D32;">Contraseña actualizada</p>
                              <p style="margin:0;font-size:13px;color:#555;">
                                Si realizaste este cambio, no necesitas hacer nada más. Tu cuenta está protegida con la nueva contraseña.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Detalles del cambio -->
              <tr>
                <td style="padding-bottom:20px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    📅
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;">Fecha y hora del cambio</p>
                              <p style="margin:0;font-size:13px;color:#185FA5;">${timeFormatted}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Advertencia: ¿No fuiste tú? -->
              <tr>
                <td style="padding-bottom:20px;">
                  <div style="background-color:#FFEBEE; padding:18px 20px; border-radius:10px; border-left:5px solid #D32F2F;">
                    <p style="margin:0 0 8px; font-size:15px; font-weight:bold; color:#D32F2F;">
                      ⚠️ ¿No reconoces este cambio?
                    </p>
                    <p style="margin:0; font-size:14px; color:#555; line-height:1.6;">
                      Si no fuiste tú quien cambió la contraseña, alguien podría tener acceso a tu cuenta. 
                      Te recomendamos actuar de inmediato.
                    </p>
                  </div>
                </td>
              </tr>

              <!-- Acciones recomendadas -->
              <tr>
                <td style="padding-bottom:20px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    🔒
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#0C447C;">Pasos recomendados:</p>
                              <ul style="margin:0;padding-left:20px;font-size:13px;color:#185FA5;">
                                <li style="margin-bottom:6px;">Cambia tu contraseña nuevamente de inmediato</li>
                                <li style="margin-bottom:6px;">Revisa los dispositivos conectados en tu perfil</li>
                                <li>Contacta a soporte si detectas actividad inusual</li>
                              </ul>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Botones de acción -->
              <tr>
                <td align="center" style="padding-bottom:20px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      ${reportLink ? `
                      <td width="48%" align="center" style="padding-right:2%;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td align="center" style="background-color:#D32F2F;border-radius:10px;">
                              <a href="${reportLink}" target="_blank"
                                style="display:inline-block;background-color:#D32F2F;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:14px 10px;border-radius:10px;text-align:center;width:100%;">
                                🚨 Reportar actividad
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                      ` : ''}
                      <td width="${reportLink ? '48%' : '100%'}" align="center">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td align="center" style="background-color:#185FA5;border-radius:10px;">
                              <a href="${process.env.FRONTEND_URL}/perfil/seguridad" target="_blank"
                                style="display:inline-block;background-color:#185FA5;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:14px 10px;border-radius:10px;text-align:center;width:100%;">
                                Ir a seguridad &rarr;
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Información legal -->
              <tr>
                <td style="padding-bottom:20px;">
                  <p style="margin:0;font-size:12px;color:#777;line-height:1.5;">
                    Si realizaste este cambio, puedes ignorar este mensaje. 
                    Recuerda que Todonto nunca te pedirá tu contraseña por correo electrónico.
                  </p>
                </td>
              </tr>

              <!-- Divisor -->
              <tr>
                <td style="border-top:1px solid #B5D4F4;padding-top:20px;padding-bottom:0;font-size:0;line-height:0;">&nbsp;</td>
              </tr>

              <!-- Soporte -->
              <tr>
                <td style="padding-top:4px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="36" style="vertical-align:top;padding-right:12px;padding-top:2px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" width="30" height="30"
                              style="background-color:#E6F1FB;border-radius:50%;text-align:center;vertical-align:middle;font-size:14px;line-height:30px;width:30px;height:30px;">
                              ℹ️
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="vertical-align:middle;">
                        <p style="margin:0;font-size:13px;color:#777777;font-family:Arial,Helvetica,sans-serif;line-height:1.65;">
                          ¿Necesitas ayuda? Escríbenos a
                          <a href="mailto:soporte@todonto.com" style="color:#185FA5;text-decoration:none;font-weight:bold;">
                            soporte@todonto.com
                          </a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding-top:12px;">
                  <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">
                    <a href="${process.env.FRONTEND_URL}/terminos" style="color:#185FA5;text-decoration:underline;">Términos y Condiciones</a> 
                    · 
                    <a href="${process.env.FRONTEND_URL}/privacidad" style="color:#185FA5;text-decoration:underline;">Aviso de Privacidad</a>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td class="email-footer" align="center"
            style="background-color:#042C53;padding:24px 40px;border-radius:0 0 14px 14px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <span style="color:rgba(255,255,255,0.55);font-size:13px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                    🦷 Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:rgba(255,255,255,0.35);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    &copy; 2026 Todonto · Todos los derechos reservados
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.22);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    Este es un mensaje automático de seguridad. No respondas a este correo.
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

    await sendEmail(to, subject, html);
}

/**
 * Envía un recibo por correo después de una suscripción (paga o prueba).
 * @param to - Correo del usuario
 * @param username - Nombre del usuario
 * @param plan - Nombre del plan
 * @param subtotal - Subtotal antes de impuestos
 * @param tax - Monto de impuestos aplicados (ej. 0.16 * subtotal)
 * @param total - Total a pagar (subtotal + tax)
 * @param currency - Moneda
 * @param startDate - Fecha de inicio
 * @param endDate - Fecha de fin (null si perpetua)
 * @param invoiceNumber - Número de recibo/factura (único)
 * @param paymentMethod - Método de pago (ej. "Tarjeta terminada en 1234")
 * @param isTrial - Si es periodo de prueba
 */
export async function sendSubscriptionReceipt(
    to: string,
    username: string,
    plan: string,
    subtotal: number,
    tax: number,
    total: number,
    currency: string,
    startDate: Date,
    endDate: Date | null,
    invoiceNumber: string,
    paymentMethod: string,
    isTrial: boolean = false
) {
    const subject = isTrial
        ? '🧾 Comienza tu periodo de prueba – Todonto'
        : '🧾 Gracias por tu suscripción – Todonto';

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        }).format(value);
    };

    const subtotalFormatted = formatCurrency(subtotal);
    const taxFormatted = formatCurrency(tax);
    const totalFormatted = formatCurrency(total);
    const startFormatted = formatDate(startDate);
    const endFormatted = endDate ? formatDate(endDate) : 'Nunca (suscripción de por vida)';

    // Texto sobre cobro automático (solo si no es prueba y es pago recurrente)
    let autoRenewText = '';
    if (!isTrial && total > 0) {
        autoRenewText = `
            <div style="background-color:#FFF3E0; padding:14px 18px; border-radius:8px; margin:20px 0;">
                <p style="margin:0; font-size:13px; color:#E65100;">
                    <strong>🔁 Cobro automático:</strong> Aceptas que se te cobrará de forma automática un cargo <strong>${plan.toLowerCase()}</strong> de ${totalFormatted} por el servicio de Todonto hasta que canceles la suscripción. Puedes cancelar en cualquier momento desde la página de tu cuenta. No se realizan reembolsos parciales. Se aplican <a href="${process.env.FRONTEND_URL}/terminos" style="color:#185FA5;">Términos y Condiciones</a>.
                </p>
            </div>
        `;
    } else if (isTrial) {
        autoRenewText = `
            <div style="background-color:#FFF3E0; padding:14px 18px; border-radius:8px; margin:20px 0;">
                <p style="margin:0; font-size:13px; color:#E65100;">
                    <strong>⚠️ Tu prueba termina el ${endFormatted}.</strong> Al finalizar, se cobrará automáticamente el plan mensual (${totalFormatted}) a menos que canceles antes.
                </p>
            </div>
        `;
    }

    const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recibo de suscripción - Todonto</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f0f4f8; }

    @media only screen and (max-width: 600px) {
      .email-wrapper  { width: 100% !important; }
      .email-header   { padding: 28px 20px !important; }
      .email-body     { padding: 24px 20px !important; }
      .email-footer   { padding: 20px !important; }
      .feature-inner  { padding: 14px !important; }
      .cta-btn        { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">

<div style="display:none;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Gracias por tu suscripción. Recibo adjunto.
</div>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0f4f8;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table class="email-wrapper" role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">

        <!-- ===== HEADER ===== -->
        <tr>
          <td class="email-header" align="center"
            style="background-color:#185FA5;padding:36px 40px 30px;border-radius:14px 14px 0 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" width="54" height="54"
                        style="background-color:#0C447C;border-radius:14px;text-align:center;vertical-align:middle;font-size:26px;line-height:54px;width:54px;height:54px;">
                        🧾
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:#ffffff;font-size:24px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">
                    Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.6);font-size:11px;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Recibo de suscripción
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== BODY ===== -->
        <tr>
          <td class="email-body"
            style="background-color:#ffffff;padding:36px 40px;border-left:1px solid #B5D4F4;border-right:1px solid #B5D4F4;">

            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Saludo -->
              <tr>
                <td style="padding-bottom:8px;">
                  <span style="font-size:22px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">
                    ¡Gracias por tu pedido, ${username}! 👋
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <p style="margin:0;font-size:15px;color:#555555;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">
                    Encontrarás adjunto el recibo de tu suscripción a <strong style="color:#185FA5;">Todonto</strong>.
                    ${isTrial ? 'Tu periodo de prueba ya está activo.' : '¡Disfruta de todos los beneficios!'}
                  </p>
                </td>
              </tr>

              <!-- Divisor bicolor -->
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="35%" height="3" style="background-color:#185FA5;font-size:0;line-height:0;">&nbsp;</td>
                      <td width="65%" height="3" style="background-color:#B5D4F4;font-size:0;line-height:0;">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Artículos -->
              <tr>
                <td style="padding-bottom:14px;">
                  <span style="font-size:11px;font-weight:bold;color:#185FA5;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Artículos
                  </span>
                </td>
              </tr>

              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    📦
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;">Plan contratado</p>
                              <p style="margin:0;font-size:13px;color:#185FA5;">${plan}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Fecha, Número de recibo y Método de pago -->
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    💳
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;">Fecha</p>
                              <p style="margin:0;font-size:13px;color:#185FA5;">${startFormatted}</p>
                              <p style="margin:10px 0 3px;font-size:14px;font-weight:bold;color:#0C447C;">Número de recibo</p>
                              <p style="margin:0;font-size:13px;color:#185FA5;word-break:break-all;">${invoiceNumber}</p>
                              <p style="margin:10px 0 3px;font-size:14px;font-weight:bold;color:#0C447C;">Método de pago</p>
                              <p style="margin:0;font-size:13px;color:#185FA5;">${paymentMethod}</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </table>

              <!-- Detalle de cargos (subtotal, impuestos, total) -->
              <tr>
                <td style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    💰
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#0C447C;">Resumen de cargos</p>
                              <p style="margin:0;font-size:13px;color:#185FA5;display:flex;justify-content:space-between;">
                                <span>Subtotal:</span> <span>${subtotalFormatted}</span>
                              </p>
                              <p style="margin:5px 0;font-size:13px;color:#185FA5;display:flex;justify-content:space-between;">
                                <span>IVA (16%):</span> <span>${taxFormatted}</span>
                              </p>
                              <p style="margin:5px 0 0;font-size:15px;font-weight:bold;color:#0C447C;display:flex;justify-content:space-between;">
                                <span>Total:</span> <span>${totalFormatted}</span>
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Información de cobro automático / prueba -->
              ${autoRenewText}

              <!-- Botón de cancelar (como enlace) -->
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <p style="margin:0;font-size:13px;color:#555;">
                    Puedes cancelar tu suscripción en cualquier momento desde la página de tu cuenta.
                    <a href="${process.env.FRONTEND_URL}/perfil/cancelar-suscripcion" style="color:#185FA5;text-decoration:underline;">Cancelar suscripción</a>
                  </p>
                </td>
              </tr>

              <!-- Divisor -->
              <tr>
                <td style="border-top:1px solid #B5D4F4;padding-top:20px;padding-bottom:0;font-size:0;line-height:0;">&nbsp;</td>
              </tr>

              <!-- Soporte -->
              <tr>
                <td style="padding-top:4px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="36" style="vertical-align:top;padding-right:12px;padding-top:2px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" width="30" height="30"
                              style="background-color:#E6F1FB;border-radius:50%;text-align:center;vertical-align:middle;font-size:14px;line-height:30px;width:30px;height:30px;">
                              ℹ️
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="vertical-align:middle;">
                        <p style="margin:0;font-size:13px;color:#777777;font-family:Arial,Helvetica,sans-serif;line-height:1.65;">
                          ¿Tienes alguna pregunta o reclamo? Escríbenos a
                          <a href="mailto:soporte@todonto.com" style="color:#185FA5;text-decoration:none;font-weight:bold;">
                            soporte@todonto.com
                          </a>
                          — te responderemos en menos de 24 horas.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding-top:12px;">
                  <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">
                    Todonto S.A. de C.V.<br/>
                    Regeringsgatan 19, SE-111 53 Stockholm, Sweden (ejemplo)<br/>
                    VAT ID: SESomething
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td class="email-footer" align="center"
            style="background-color:#042C53;padding:24px 40px;border-radius:0 0 14px 14px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <span style="color:rgba(255,255,255,0.55);font-size:13px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                    🦷 Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:rgba(255,255,255,0.35);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    &copy; 2026 Todonto · Todos los derechos reservados
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.22);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    Este mensaje fue enviado a ${to}.
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </table>

      </table>
    </td>
  </td>
</table>
</body>
</html>`;

    await sendEmail(to, subject, html);
}

/**
 * Envía una alerta cuando la cuenta ha sido bloqueada por muchos intentos fallidos
 * @param to - Correo del usuario
 * @param username - Nombre del usuario
 * @param blockDurationMinutes - Duración del bloqueo en minutos (ej. 15)
 * @param attempts - Número de intentos fallidos que causaron el bloqueo
 * @param blockExpiresAt - Fecha y hora en que terminará el bloqueo
 * @param resetPasswordLink - Enlace para restablecer contraseña (opcional)
 * @param supportLink - Enlace a soporte (opcional)
 */
export async function sendAccountBlockedAlert(
    to: string,
    username: string,
    blockDurationMinutes: number,
    attempts: number,
    blockExpiresAt: Date,
    resetPasswordLink?: string,
    supportLink?: string
) {
    const subject = '🔒 Tu cuenta ha sido bloqueada temporalmente - Todonto';

    const formatDateTime = (date: Date) => {
        return date.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const expiresFormatted = formatDateTime(blockExpiresAt);

    const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cuenta bloqueada - Todonto</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0 !important; padding: 0 !important; background-color: #f0f4f8; }

    @media only screen and (max-width: 600px) {
      .email-wrapper  { width: 100% !important; }
      .email-header   { padding: 28px 20px !important; }
      .email-body     { padding: 24px 20px !important; }
      .email-footer   { padding: 20px !important; }
      .feature-inner  { padding: 14px !important; }
      .cta-btn        { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">

<div style="display:none;font-size:1px;color:#f0f4f8;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Tu cuenta ha sido bloqueada temporalmente por seguridad tras ${attempts} intentos fallidos.
</div>

<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f0f4f8;">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table class="email-wrapper" role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;">

        <!-- ===== HEADER ===== -->
        <tr>
          <td class="email-header" align="center"
            style="background-color:#185FA5;padding:36px 40px 30px;border-radius:14px 14px 0 0;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:10px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" width="54" height="54"
                        style="background-color:#0C447C;border-radius:14px;text-align:center;vertical-align:middle;font-size:26px;line-height:54px;width:54px;height:54px;">
                        🦷
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:#ffffff;font-size:24px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.3px;">
                    Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.6);font-size:11px;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Alerta de seguridad
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ===== BODY ===== -->
        <tr>
          <td class="email-body"
            style="background-color:#ffffff;padding:36px 40px;border-left:1px solid #B5D4F4;border-right:1px solid #B5D4F4;">

            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">

              <!-- Saludo -->
              <tr>
                <td style="padding-bottom:8px;">
                  <span style="font-size:22px;font-weight:bold;color:#0C447C;font-family:Arial,Helvetica,sans-serif;line-height:1.3;">
                    ¡Hola, ${username}! 👋
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <p style="margin:0;font-size:15px;color:#555555;line-height:1.75;font-family:Arial,Helvetica,sans-serif;">
                    Hemos detectado <strong>${attempts} intentos fallidos consecutivos</strong> para iniciar sesión en tu cuenta de 
                    <strong style="color:#185FA5;">Todonto</strong>. Por seguridad, tu cuenta ha sido 
                    <strong style="color:#D32F2F;">bloqueada temporalmente por ${blockDurationMinutes} minutos</strong>.
                  </p>
                </td>
              </tr>

              <!-- Divisor bicolor -->
              <tr>
                <td style="padding-bottom:24px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="35%" height="3" style="background-color:#185FA5;font-size:0;line-height:0;">&nbsp;</td>
                      <td width="65%" height="3" style="background-color:#B5D4F4;font-size:0;line-height:0;">&nbsp;</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Etiqueta sección -->
              <tr>
                <td style="padding-bottom:14px;">
                  <span style="font-size:11px;font-weight:bold;color:#185FA5;font-family:Arial,Helvetica,sans-serif;letter-spacing:1.2px;text-transform:uppercase;">
                    Detalles del bloqueo
                  </span>
                </td>
              </tr>

              <!-- Bloque de expiración -->
              <tr>
                <td style="padding-bottom:20px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#FFEBEE;border-radius:10px;border-left:5px solid #D32F2F;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#D32F2F;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    ⏰
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#D32F2F;">Fin del bloqueo</p>
                              <p style="margin:0;font-size:13px;color:#555;">
                                ${expiresFormatted}
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Intentos fallidos -->
              <tr>
                <td style="padding-bottom:20px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#FFF3E0;border-radius:10px;border-left:3px solid #E65100;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#E65100;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    🔁
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 3px;font-size:14px;font-weight:bold;color:#E65100;">Intentos fallidos</p>
                              <p style="margin:0;font-size:13px;color:#555;">${attempts} intentos consecutivos</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Mensaje de advertencia -->
              <tr>
                <td style="padding-bottom:20px;">
                  <div style="background-color:#FFEBEE; padding:18px 20px; border-radius:10px; border-left:5px solid #D32F2F;">
                    <p style="margin:0 0 8px; font-size:15px; font-weight:bold; color:#D32F2F;">
                      ⚠️ Motivo del bloqueo
                    </p>
                    <p style="margin:0; font-size:14px; color:#555; line-height:1.6;">
                      Demasiados intentos fallidos consecutivos. Esto podría deberse a un olvido de contraseña 
                      o a un intento de acceso no autorizado. Por tu seguridad, hemos bloqueado temporalmente la cuenta.
                    </p>
                  </div>
                </td>
              </tr>

              <!-- Acciones recomendadas -->
              <tr>
                <td style="padding-bottom:20px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
                    style="background-color:#E6F1FB;border-radius:10px;border-left:3px solid #185FA5;">
                    <tr>
                      <td class="feature-inner" style="padding:16px 18px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td width="52" style="vertical-align:top;padding-right:14px;">
                              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" width="38" height="38"
                                    style="background-color:#185FA5;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;line-height:38px;width:38px;height:38px;">
                                    🔒
                                  </td>
                                </tr>
                              </table>
                            </td>
                            <td style="vertical-align:top;">
                              <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#0C447C;">¿Qué puedes hacer?</p>
                              <ul style="margin:0;padding-left:20px;font-size:13px;color:#185FA5;">
                                <li style="margin-bottom:6px;">Espera a que termine el bloqueo para volver a intentarlo.</li>
                                <li style="margin-bottom:6px;">Si olvidaste tu contraseña, utiliza la opción de restablecer.</li>
                                <li>Si no fuiste tú, contacta a soporte de inmediato.</li>
                              </ul>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Botones de acción -->
              <tr>
                <td align="center" style="padding-bottom:20px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      ${resetPasswordLink ? `
                      <td width="${supportLink ? '48%' : '100%'}" align="center" style="${supportLink ? 'padding-right:2%;' : ''}">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td align="center" style="background-color:#185FA5;border-radius:10px;">
                              <a href="${resetPasswordLink}" target="_blank"
                                style="display:inline-block;background-color:#185FA5;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:14px 10px;border-radius:10px;text-align:center;width:100%;">
                                Restablecer contraseña &rarr;
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                      ` : ''}
                      ${supportLink ? `
                      <td width="${resetPasswordLink ? '48%' : '100%'}" align="center">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td align="center" style="background-color:#D32F2F;border-radius:10px;">
                              <a href="${supportLink}" target="_blank"
                                style="display:inline-block;background-color:#D32F2F;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:14px 10px;border-radius:10px;text-align:center;width:100%;">
                                🚨 Contactar soporte
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                      ` : ''}
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Información legal -->
              <tr>
                <td style="padding-bottom:20px;">
                  <p style="margin:0;font-size:12px;color:#777;line-height:1.5;">
                    Si fuiste tú quien olvidó la contraseña, no te preocupes, podrás volver a intentarlo tras el bloqueo. 
                    Si no reconoces esta actividad, te recomendamos restablecer tu contraseña y revisar la seguridad de tu cuenta.
                  </p>
                </td>
              </tr>

              <!-- Divisor -->
              <tr>
                <td style="border-top:1px solid #B5D4F4;padding-top:20px;padding-bottom:0;font-size:0;line-height:0;">&nbsp;</td>
              </tr>

              <!-- Soporte -->
              <tr>
                <td style="padding-top:4px;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td width="36" style="vertical-align:top;padding-right:12px;padding-top:2px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td align="center" width="30" height="30"
                              style="background-color:#E6F1FB;border-radius:50%;text-align:center;vertical-align:middle;font-size:14px;line-height:30px;width:30px;height:30px;">
                              ℹ️
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td style="vertical-align:middle;">
                        <p style="margin:0;font-size:13px;color:#777777;font-family:Arial,Helvetica,sans-serif;line-height:1.65;">
                          ¿Necesitas ayuda adicional? Escríbenos a
                          <a href="mailto:soporte@todonto.com" style="color:#185FA5;text-decoration:none;font-weight:bold;">
                            soporte@todonto.com
                          </a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding-top:12px;">
                  <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">
                    <a href="${process.env.FRONTEND_URL}/terminos" style="color:#185FA5;text-decoration:underline;">Términos y Condiciones</a> 
                    · 
                    <a href="${process.env.FRONTEND_URL}/privacidad" style="color:#185FA5;text-decoration:underline;">Aviso de Privacidad</a>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>

        <!-- ===== FOOTER ===== -->
        <tr>
          <td class="email-footer" align="center"
            style="background-color:#042C53;padding:24px 40px;border-radius:0 0 14px 14px;">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:8px;">
                  <span style="color:rgba(255,255,255,0.55);font-size:13px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
                    🦷 Todonto
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:4px;">
                  <span style="color:rgba(255,255,255,0.35);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    &copy; 2026 Todonto · Todos los derechos reservados
                  </span>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <span style="color:rgba(255,255,255,0.22);font-size:11px;font-family:Arial,Helvetica,sans-serif;">
                    Este es un mensaje automático de seguridad. No respondas a este correo.
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

    await sendEmail(to, subject, html);
}