import { Request, Response } from "express";
import Stripe from "stripe";
import supabase from "../database";
import { logError } from "../utils/logError";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

function getPeriodEnd(stripeSub: any): number | null {
  if (typeof stripeSub.current_period_end === 'number') {
    return stripeSub.current_period_end;
  }
  const item = stripeSub.items?.data?.[0];
  if (typeof item?.current_period_end === 'number') {
    return item.current_period_end;
  }
  if (typeof item?.period?.end === 'number') {
    return item.period.end;
  }
  return null;
}

function unixToIso(unix: number | null | undefined): string | null {
  if (unix === null || unix === undefined) return null;
  const n = Number(unix);
  if (isNaN(n)) return null;
  const date = new Date(n * 1000);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

class WebhookController {

  public async handleStripeWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'] as string;
    let event: any;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      await logError(req, err, 'WebhookController', 'constructEvent', 'usuario', 'lStripe');
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Idempotencia global: verificar si el evento ya fue procesado
    const { data: yaProcesado } = await supabase
      .schema("usuario")
      .from("tWebhookEvent")
      .select("id_evento")
      .eq("stripe_event_id", event.id)
      .maybeSingle();

    if (yaProcesado) {
      return res.json({ received: true, message: "Evento ya procesado" });
    }

    // Pago fallido
    if (event.type === 'invoice.payment_failed') {
      try {
        const invoice = event.data.object;

        const subscriptionId: string | null =
          invoice.subscription ||
          invoice.parent?.subscription_details?.subscription ||
          invoice.lines?.data?.[0]?.parent?.subscription_item_details?.subscription ||
          null;

        if (!subscriptionId) {
          await supabase.schema("usuario").from("tWebhookEvent").insert({ stripe_event_id: event.id });
          return res.json({ received: true, message: 'No subscription, ignored' });
        }

        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
        const idUsuarioStripe = stripeSub.metadata?.id_usuario;

        if (!idUsuarioStripe) {
          await logError(req, new Error(`Suscripción sin metadata id_usuario: ${subscriptionId}`), 'WebhookController', 'payment_failed', 'usuario', 'lStripe');
          await supabase.schema("usuario").from("tWebhookEvent").insert({ stripe_event_id: event.id });
          return res.json({ received: true, message: 'No user metadata' });
        }

        const userId = parseInt(idUsuarioStripe, 10);

        const { data: usuario } = await supabase
          .schema("usuario")
          .from("tUsuario")
          .select("id_usuario")
          .eq("id_usuario", userId)
          .maybeSingle();

        if (!usuario) {
          await logError(req, new Error(`Usuario no encontrado: ${userId}`), 'WebhookController', 'payment_failed', 'usuario', 'lStripe');
          await supabase.schema("usuario").from("tWebhookEvent").insert({ stripe_event_id: event.id });
          return res.status(404).json({ error: "Usuario no encontrado" });
        }

        await supabase
          .schema("usuario")
          .from("tUsuarioSuscripcion")
          .update({ estado: 'expirada', updated_at: new Date() })
          .eq('stripe_subscription_id', subscriptionId);

        await supabase.schema("usuario").rpc("expirar_suscripciones_vencidas");
        await supabase.schema("usuario").from("tWebhookEvent").insert({ stripe_event_id: event.id });

        return res.json({ received: true });
      } catch (error: any) {
        await logError(req, error, 'WebhookController', 'payment_failed', 'usuario', 'lStripe');
        await supabase.schema("usuario").from("tWebhookEvent").insert({ stripe_event_id: event.id });
        return res.status(500).json({ error: "Error interno" });
      }
    }

    // Pago exitoso
    if (event.type === 'invoice.paid') {
      try {
        const invoice = event.data.object;
        const billingReason: string = invoice.billing_reason ?? '';
        
        if (invoice.amount_paid === 0 && billingReason === 'subscription_create') {
          await supabase.schema("usuario").from("tWebhookEvent").insert({ stripe_event_id: event.id });
          return res.json({ received: true, message: 'Trial invoice ignored' });
        }

        const subscriptionId: string | null =
          invoice.subscription ||
          invoice.parent?.subscription_details?.subscription ||
          invoice.lines?.data?.[0]?.parent?.subscription_item_details?.subscription ||
          null;

        if (!subscriptionId) {
          await supabase.schema("usuario").from("tWebhookEvent").insert({ stripe_event_id: event.id });
          return res.json({ received: true, message: 'No subscription, ignored' });
        }

        // Idempotencia por factura
        const { data: pagoExistente } = await supabase
          .schema("usuario")
          .from("tPago")
          .select("id_pago")
          .eq("stripe_invoice_id", invoice.id)
          .maybeSingle();

        if (pagoExistente) {
          await supabase.schema("usuario").from("tWebhookEvent").insert({ stripe_event_id: event.id });
          return res.json({ received: true, message: "Ya procesado" });
        }

        // Obtener suscripción de Stripe con price expandido
        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price']
        }) as any;

        const idUsuarioStripe: string | undefined = stripeSub.metadata?.id_usuario;
        if (!idUsuarioStripe) {
          await logError(req, new Error(`Suscripción sin metadata id_usuario: ${subscriptionId}`), 'WebhookController', 'invoice.paid', 'usuario', 'lStripe');
          await supabase.schema("usuario").from("tWebhookEvent").insert({ stripe_event_id: event.id });
          return res.json({ received: true, message: 'No user metadata' });
        }

        const userId = parseInt(idUsuarioStripe, 10);

        const { data: usuario } = await supabase
          .schema("usuario")
          .from("tUsuario")
          .select("id_usuario")
          .eq("id_usuario", userId)
          .maybeSingle();

        if (!usuario) {
          await logError(req, new Error(`Usuario no encontrado: ${userId}`), 'WebhookController', 'invoice.paid', 'usuario', 'lStripe');
          await supabase.schema("usuario").from("tWebhookEvent").insert({ stripe_event_id: event.id });
          return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const priceId: string | undefined =
          stripeSub.items?.data?.[0]?.price?.id ||
          invoice.lines?.data?.[0]?.pricing?.price_details?.price ||
          undefined;

        if (!priceId) {
          const err = new Error(`price.id no encontrado en suscripción: ${subscriptionId}`);
          await logError(req, err, 'WebhookController', 'invoice.paid | priceId', 'usuario', 'lStripe');
          await supabase.schema("usuario").from("tWebhookEvent").insert({ stripe_event_id: event.id });
          return res.status(500).json({ error: "Price no encontrado" });
        }

        const periodEndUnix: number | null =
          getPeriodEnd(stripeSub) ??
          invoice.lines?.data?.[0]?.period?.end ??
          null;

        // Conversión segura a ISO — si es null, la función SQL usa duracion_dias como fallback
        const fechaFinStripe: string | null = unixToIso(periodEndUnix);

        if (!fechaFinStripe) {
          console.warn(`No se pudo determinar fecha_fin para sub ${subscriptionId}. SQL usará duracion_dias.`);
        }

        // Extraer payment_intent_id (puede ser null en conversiones trial→pago)
        const paymentIntentId: string | null =
          invoice.payment_intent ||
          invoice.payment?.payment_intent ||
          null;

        // Método de pago predeterminado del usuario
        const { data: metodo } = await supabase
          .schema("usuario")
          .from("tMetodoPago")
          .select("id_metodo")
          .eq("id_usuario", userId)
          .eq("es_predeterminado", true)
          .maybeSingle();

        // Renovación automática (siguiente ciclo de facturación)
        if (billingReason === 'subscription_cycle') {
          const { error: renovarError } = await supabase
            .schema("usuario")
            .rpc("renovar_suscripcion", {
              _stripe_subscription_id: subscriptionId,
              _nuevo_monto: invoice.amount_paid / 100,
              _stripe_payment_intent_id: paymentIntentId,
              _stripe_invoice_id: invoice.id
            });

          if (renovarError) {
            await logError(req, renovarError, 'WebhookController', 'renovar_suscripcion', 'usuario', 'lStripe');
            throw new Error(`Error al renovar: ${renovarError.message}`);
          }

          await supabase.schema("usuario").from("tWebhookEvent").insert({ stripe_event_id: event.id });
          return res.json({ received: true });
        }

        const { data: plan, error: planError } = await supabase
          .schema("usuario")
          .from("tTipoSuscripcion")
          .select("nombre")
          .eq("stripe_price_id", priceId)
          .maybeSingle();

        if (planError || !plan) {
          const err = new Error(`Plan no encontrado para stripe_price_id: ${priceId}`);
          await logError(req, err, 'WebhookController', 'invoice.paid | plan lookup', 'usuario', 'lStripe');
          return res.status(500).json({ error: "Plan no encontrado" });
        }

        const { error: convertirError } = await supabase
          .schema("usuario")
          .rpc("convertir_a_plan_pago", {
            _id_usuario: userId,
            _nombre_plan: plan.nombre,
            _stripe_subscription_id: subscriptionId,
            _stripe_payment_intent_id: paymentIntentId,
            _stripe_invoice_id: invoice.id,
            _monto: invoice.amount_paid / 100,
            _id_metodo_pago: metodo?.id_metodo ?? null,
            _fecha_fin: fechaFinStripe   // null si no se pudo determinar → SQL usa duracion_dias
          });

        if (convertirError) {
          await logError(req, convertirError, 'WebhookController', 'convertir_a_plan_pago', 'usuario', 'lStripe');
          throw new Error(`Error al convertir: ${convertirError.message}`);
        }

        await supabase.schema("usuario").from("tWebhookEvent").insert({ stripe_event_id: event.id });
        return res.json({ received: true });

      } catch (error: any) {
        await logError(req, error, 'WebhookController', 'invoice.paid', 'usuario', 'lStripe');
        // No registramos para que Stripe pueda reintentar errores inesperados
        return res.status(500).json({ error: "Error interno" });
      }
    }

    // Suscripción eliminada
    if (event.type === 'customer.subscription.deleted') {
      try {
        const subscription = event.data.object;
        const subscriptionId: string = subscription.id;
        const idUsuarioStripe: string | undefined = subscription.metadata?.id_usuario;

        if (!idUsuarioStripe) {
          await supabase.schema("usuario").from("tWebhookEvent").insert({ stripe_event_id: event.id });
          return res.json({ received: true, message: 'No user metadata' });
        }

        const userId = parseInt(idUsuarioStripe, 10);

        const { data: usuario } = await supabase
          .schema("usuario")
          .from("tUsuario")
          .select("id_usuario")
          .eq("id_usuario", userId)
          .maybeSingle();

        if (usuario) {
          await supabase
            .schema("usuario")
            .from("tUsuarioSuscripcion")
            .update({ estado: 'expirada', updated_at: new Date() })
            .eq('stripe_subscription_id', subscriptionId);

          await supabase.schema("usuario").rpc("expirar_suscripciones_vencidas");
        }

        await supabase.schema("usuario").from("tWebhookEvent").insert({ stripe_event_id: event.id });
        return res.json({ received: true });

      } catch (error: any) {
        await logError(req, error, 'WebhookController', 'subscription.deleted', 'usuario', 'lStripe');
        await supabase.schema("usuario").from("tWebhookEvent").insert({ stripe_event_id: event.id });
        return res.status(500).json({ error: "Error interno" });
      }
    }

    // Eventos no manejados
    await supabase.schema("usuario").from("tWebhookEvent").insert({ stripe_event_id: event.id });
    return res.json({ received: true });
  }
}

export const webHookController = new WebhookController();