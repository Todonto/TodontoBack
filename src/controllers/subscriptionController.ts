import { Request, Response } from "express";
import Stripe from "stripe";
import supabase from "../database";
import { logError } from "../utils/logError";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-04-22.dahlia"
});

class SubscriptionController {

    /**
     * GET /api/sub/plans
     * Obtiene todos los planes disponibles para Todonto.
     */
    public async getPlans(req: Request, res: Response) {
        try {
            const { data, error } = await supabase
                .schema("usuario")
                .from("tTipoSuscripcion")
                .select("*")
                .eq("activo", true)
                .order("precio");

            if (error) {
                await logError(req, error, 'SubscriptionController', 'getPlans', 'usuario', 'lStripe');
                return res.status(500).json({ message: "Error al obtener los planes" });
            }

            res.json(data);
        } catch (err) {
            await logError(req, err, 'SubscriptionController', 'getPlans', 'usuario', 'lStripe');
            res.status(500).json({ message: "Error interno del servidor" });
        }
    }

    /**
     * POST /api/sub/trial
     * Asigna el plan de prueba a usuario.
     */
    async startTrial(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const { payment_method_id } = req.body;

        if (!payment_method_id)
            return res.status(400).json({ message: "payment_method_id requerido" });

        // Usamos el price_id del plan Profesional (mensual)
        const targetPriceId = process.env.DEFAULT_TRIAL_PRICE_ID;

        // Obtener o crear customer
        const { data: usuarioDB, error: userDBError } = await supabase
            .schema("usuario")
            .from("tUsuario")
            .select("stripe_customer_id")
            .eq("id_usuario", user.id_usuario)
            .single();

        if (userDBError) throw userDBError;

        let customerId = usuarioDB.stripe_customer_id;

        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.correo_electronico,
                name: user.nombre_usuario,
            });
            customerId = customer.id;

            // Guardar en la base de datos
            await supabase
                .schema("usuario")
                .from("tUsuario")
                .update({ stripe_customer_id: customerId })
                .eq("id_usuario", user.id_usuario);
            }

            // Adjuntar y hacer predeterminado el método de pago
            await stripe.paymentMethods.attach(payment_method_id, { customer: customerId });
            await stripe.customers.update(customerId, {
                invoice_settings: { default_payment_method: payment_method_id },
            });

            const pm = await stripe.paymentMethods.retrieve(payment_method_id);

            // Crear suscripción con trial de 14 días en Stripe
            const trialEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60; // 14 días en segundos UNIX

            const subscription = await stripe.subscriptions.create({
                customer: customerId,
                items: [{ price: targetPriceId! }],
                default_payment_method: payment_method_id,
                trial_end: trialEnd,
                expand: ['latest_invoice.payment_intent'],
                metadata: { id_usuario: user.id_usuario },
            });

            // Llamar a la función SQL que guarda la prueba con referencia a la suscripción
            const { error } = await supabase
                .schema("usuario")
                .rpc("activar_prueba_con_suscripcion", {
                    _id_usuario: user.id_usuario,
                    _stripe_customer_id: customerId,
                    _stripe_payment_method_id: payment_method_id,
                    _tipo_metodo: "card",
                    _marca: pm.card?.brand,
                    _ultimos_digitos: pm.card?.last4,
                    _expira_mes: pm.card?.exp_month,
                    _expira_anio: pm.card?.exp_year,
                    _stripe_subscription_id: subscription.id,
                    _fecha_fin_trial: new Date(trialEnd * 1000).toISOString()
                });

            if (error) throw error;

            return res.json({
                message: "Prueba activada. Se convertirá automáticamente en plan de pago al finalizar los 14 días.",
                subscription_id: subscription.id,
                trial_end: trialEnd
            });
        } catch (error: any) {
            await logError(req, error, "Subscription", "startTrial", "usuario", "lStripe");
            return res.status(500).json({ message: error.message || "Error al activar la prueba" });
        }
    }

    /**
     * POST /api/sub/subscribe
     * Asigna un plan de pago a usuario.
     */
    async subscribe(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const { price_id, payment_method_id } = req.body;

            if (!price_id) {
                return res.status(400).json({ message: "price_id es requerido" });
            }

            const { data: lockAcquired, error: lockError } = await supabase
                .schema("usuario")
                .rpc("lock_usuario_suscripcion", { _id_usuario: user.id_usuario })
                .single();

            if (lockError || !lockAcquired) {
                return res.status(409).json({
                    message: "Ya hay un proceso de suscripción en curso. Intenta de nuevo en unos segundos."
                });
            }

            // Verificar que no tenga ya un plan de pago activo
            const { data: subActiva } = await supabase
                .schema("usuario")
                .from("tUsuarioSuscripcion")
                .select("stripe_subscription_id, tTipoSuscripcion!inner(es_prueba)")
                .eq("id_usuario", user.id_usuario)
                .eq("estado", "activa")
                .not("stripe_subscription_id", "is", null)
                .maybeSingle();

            if (subActiva && !(subActiva as any).tTipoSuscripcion?.es_prueba) {
                return res.status(400).json({
                    message: "Ya tienes un plan de pago activo. Usa /change-plan para actualizarlo.",
                });
            }

            // Obtener o crear el customer de Stripe
            const { data: usuarioDB, error: userDBError } = await supabase
                .schema("usuario")
                .from("tUsuario")
                .select("stripe_customer_id")
                .eq("id_usuario", user.id_usuario)
                .single();

            if (userDBError) throw userDBError;

            let customerId = usuarioDB.stripe_customer_id;

            if (!customerId) {
                const customer = await stripe.customers.create({
                    email: user.correo_electronico,
                    name: user.nombre_usuario,
                });
                customerId = customer.id;

                await supabase
                    .schema("usuario")
                    .from("tUsuario")
                    .update({ stripe_customer_id: customerId })
                    .eq("id_usuario", user.id_usuario);
            }

            // Si se envió un nuevo método de pago, adjuntarlo y hacerlo predeterminado.
            // Si no, sincronizar el que tengamos en base de datos con Stripe.
            let metodoPagoLocalId: number | null = null;
            let metodoPagoStripeId: string | undefined = undefined;

            if (payment_method_id) {
                // Adjuntar al customer
                await stripe.paymentMethods.attach(payment_method_id, { customer: customerId });

                // Hacerlo predeterminado
                await stripe.customers.update(customerId, {
                    invoice_settings: {
                        default_payment_method: payment_method_id,
                    },
                });

                // Obtener datos del método de pago
                const pm = await stripe.paymentMethods.retrieve(payment_method_id);

                // Insertar o actualizar en tMetodoPago
                const { data: metodoInsertado, error: metodoError } = await supabase
                    .schema("usuario")
                    .from("tMetodoPago")
                    .upsert({
                        id_usuario: user.id_usuario,
                        stripe_payment_method_id: payment_method_id,
                        tipo: pm.type || 'card',
                        marca: pm.card?.brand || null,
                        ultimos_digitos: pm.card?.last4 || null,
                        expira_mes: pm.card?.exp_month || null,
                        expira_anio: pm.card?.exp_year || null,
                        es_predeterminado: true,
                        activo: true,
                    },
                    { onConflict: 'stripe_payment_method_id' })
                    .select('id_metodo')
                    .single();

                if (metodoError) throw metodoError;
                metodoPagoLocalId = metodoInsertado.id_metodo;

                // Asegurar que solo ese método quede como predeterminado
                await supabase
                    .schema("usuario")
                    .from("tMetodoPago")
                    .update({ es_predeterminado: false })
                    .eq('id_usuario', user.id_usuario)
                    .neq('id_metodo', metodoPagoLocalId);

                metodoPagoStripeId = payment_method_id;
            } else {
                // No se envió método nuevo, buscamos el predeterminado en base de datos
                const { data: metodoExistente, error: metodoExistenteError } = await supabase
                    .schema("usuario")
                    .from("tMetodoPago")
                    .select("id_metodo, stripe_payment_method_id")
                    .eq("id_usuario", user.id_usuario)
                    .eq("es_predeterminado", true)
                    .eq("activo", true)
                    .maybeSingle();

                if (metodoExistenteError || !metodoExistente) {
                    return res.status(400).json({
                        message: "No tienes un método de pago predeterminado. Envía payment_method_id.",
                    });
                }
                metodoPagoLocalId = metodoExistente.id_metodo;
                metodoPagoStripeId = metodoExistente.stripe_payment_method_id;

                if (!metodoPagoStripeId) {
                    return res.status(400).json({ message: "El método de pago predeterminado no es válido." });
                }

                // Sincronizar con Stripe: asegurar que el customer tenga ese método por defecto
                await stripe.customers.update(customerId, {
                    invoice_settings: {
                        default_payment_method: metodoPagoStripeId,
                    },
                });
            }

            if (!metodoPagoStripeId) {
                return res.status(400).json({ message: "No se pudo determinar el método de pago." });
            }
            const paymentMethod: string = metodoPagoStripeId;

            // Cancelar inmediatamente cualquier suscripción de prueba activa en Stripe
            const trialingSubs = await stripe.subscriptions.list({
                customer: customerId,
                status: 'trialing',
                limit: 5,
            });

            for (const trialSub of trialingSubs.data) {
                await stripe.subscriptions.cancel(trialSub.id); // Elimina la suscripción de inmediato
            }

            // Obtener el nombre y precio del plan desde la base de datos
            const { data: plan, error: planError } = await supabase
                .schema("usuario")
                .from("tTipoSuscripcion")
                .select("nombre, precio")
                .eq("stripe_price_id", price_id)
                .single();

            if (planError || !plan) {
                return res.status(400).json({ message: "Plan no encontrado para el price_id proporcionado." });
            }

            // Crear la suscripción en Stripe (cobro inmediato o pendiente 3DS)
            const subscription = await stripe.subscriptions.create({
                customer: customerId,
                items: [{ price: price_id }],
                default_payment_method: paymentMethod,
                expand: ['latest_invoice.payment_intent'],
                metadata: { id_usuario: user.id_usuario },
            }, {
                idempotencyKey: `sub_${user.id_usuario}_${price_id}`
            }) as any;

            // El webhook confirmará el pago.
            return res.json({
                message: "Suscripción creada. El pago se confirmará en breve.",
                subscription_id: subscription.id,
                status: subscription.status, // Esto es informativo para el frontend
                plan: plan.nombre,
            });

        } catch (error: any) {
            await logError(req, error, "Subscription", "subscribe", "usuario", "lStripe");
            return res.status(500).json({ message: error.message || "Error al crear la suscripción" });
        }
    }

    /**
     * POST /api/sub/change-plan
     * Cambia el plan actual del usuario.
     */
    async changePlan(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const { new_price_id } = req.body;

            if (!new_price_id) {
                return res.status(400).json({ message: "new_price_id es requerido" });
            }

            // Obtener la suscripción activa con JOIN para obtener es_prueba
            const { data: sub, error: subError } = await supabase
                .schema("usuario")
                .from("tUsuarioSuscripcion")
                .select(`
                    id_suscripcion,
                    stripe_subscription_id,
                    id_tipo_suscripcion,
                    tTipoSuscripcion!inner(es_prueba)
                `)
                .eq("id_usuario", user.id_usuario)
                .eq("estado", "activa")
                .not("stripe_subscription_id", "is", null)
                .single();

            if (subError || !sub) {
                return res.status(404).json({ message: "No tienes una suscripción activa para cambiar." });
            }

            // No permitir cambiar desde una prueba (debe usar subscribe)
            if ((sub as any).tTipoSuscripcion?.es_prueba) {
                return res.status(400).json({
                    message: "Estás en período de prueba. Usa /subscribe para elegir un plan de pago.",
                });
            }

            // Obtener los datos del nuevo plan desde la base de datos
            const { data: newPlan, error: planError } = await supabase
                .schema("usuario")
                .from("tTipoSuscripcion")
                .select("id_tipo_suscripcion, nombre, duracion_dias")
                .eq("stripe_price_id", new_price_id)
                .single();

            if (planError || !newPlan) {
                return res.status(400).json({ message: "El plan solicitado no existe." });
            }

            // Recuperar la suscripción actual de Stripe para obtener el item de suscripción
            const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);

            const subscriptionItem = stripeSub.items.data[0];
            if (!subscriptionItem) {
                return res.status(400).json({ message: "La suscripción no tiene items válidos" });
            }

            // Actualizar la suscripción en Stripe con prorrateo
            await stripe.subscriptions.update(sub.stripe_subscription_id, {
                items: [{
                    id: subscriptionItem.id,
                    price: new_price_id,
                }],
                proration_behavior: "create_prorations",
            });

            // Obtener la suscripción actualizada con retrieve
            const updatedStripeSub: any = await stripe.subscriptions.retrieve(
                sub.stripe_subscription_id,
                { expand: ['items.data.price'] }
            );
        
            const currentPeriodEnd = updatedStripeSub.current_period_end 
                ?? updatedStripeSub.items?.data?.[0]?.current_period_end;
            const nuevaFechaFin = currentPeriodEnd
                ? new Date(currentPeriodEnd * 1000).toISOString()
                : null;

            const { error: updateError } = await supabase
                .schema("usuario")
                .from("tUsuarioSuscripcion")
                .update({
                    id_tipo_suscripcion: newPlan.id_tipo_suscripcion,
                    fecha_fin: nuevaFechaFin,
                    updated_at: new Date().toISOString(),
                })
                .eq("id_suscripcion", sub.id_suscripcion);

            if (updateError) throw updateError;

            return res.json({
                message: "Plan actualizado exitosamente",
                plan: newPlan.nombre,
                nueva_fecha_fin: nuevaFechaFin,
            });
        } catch (error: any) {
            await logError(req, error, "Subscription", "changePlan", "usuario", "lStripe");
            return res.status(500).json({ message: error.message || "Error al cambiar de plan" });
        }
    }

    /**
     * POST /api/sub/cancel
     * Cancela el plan del usuario y pone el plan inicial.
     */
    async cancel(req: Request, res: Response) {
        try {
            const user = (req as any).user;

            // Obtener suscripción activa con datos del tipo
            const { data: sub, error: subError } = await supabase
                .schema("usuario")
                .from("tUsuarioSuscripcion")
                .select(`
                    id_suscripcion,
                    stripe_subscription_id,
                    estado,
                    tTipoSuscripcion!inner(es_prueba, nombre)
                `)
                .eq("id_usuario", user.id_usuario)
                .eq("estado", "activa")
                .not("stripe_subscription_id", "is", null)
                .single();

            if (subError || !sub) {
                return res.status(400).json({ message: "No tienes un plan activo para cancelar." });
            }

            const esPrueba = (sub as any).tTipoSuscripcion?.es_prueba;
            const nombrePlan = (sub as any).tTipoSuscripcion?.nombre;
            const stripeSubId = sub.stripe_subscription_id;

            if (esPrueba) {
                // Cancelar inmediatamente en Stripe
                await stripe.subscriptions.cancel(stripeSubId);

                // Marcar la suscripción de prueba como expirada
                await supabase
                    .schema("usuario")
                    .from("tUsuarioSuscripcion")
                    .update({ estado: 'expirada', updated_at: new Date() })
                    .eq("id_suscripcion", sub.id_suscripcion);

                // Insertar plan Inicio
                const { data: planInicio } = await supabase
                    .schema("usuario")
                    .from("tTipoSuscripcion")
                    .select("id_tipo_suscripcion")
                    .eq("nombre", "Inicio")
                    .single();

                await supabase
                    .schema("usuario")
                    .from("tUsuarioSuscripcion")
                    .insert({
                        id_usuario: user.id_usuario,
                        id_tipo_suscripcion: planInicio!.id_tipo_suscripcion,
                        fecha_inicio: new Date().toISOString(),
                        estado: 'activa',
                    });

                return res.json({
                    message: "Prueba cancelada. Has vuelto al plan Inicio.",
                    plan_actual: "Inicio"
                });
            }

            // Plan de pago: cancelar al final del periodo
            await stripe.subscriptions.update(stripeSubId, {
                cancel_at_period_end: true
            });

            const { data: resultData, error: cancelError } = await supabase
                .schema("usuario")
                .rpc("cancelar_suscripcion", { _id_usuario: user.id_usuario });

            if (cancelError) throw cancelError;

            // Accedemos a fecha_fin
            const fecha = Array.isArray(resultData) ? resultData[0]?.fecha_fin : (resultData as any)?.fecha_fin;

            return res.json({
                message: "Cancelada al finalizar periodo",
                plan: nombrePlan,
                acceso_hasta: fecha
            });
        } catch (error: any) {
            await logError(req, error, "Subscription", "cancel", "usuario", "lStripe");
            return res.status(500).json({ message: error.message || "Error al cancelar" });
        }
    }
}

export const subscriptionController = new SubscriptionController();