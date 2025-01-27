import express from 'express';
import { validationResult } from 'express-validator';
import { catchErrors } from '../lib/catch-errors.js';
import { doesExistCart, doesExistSingleOrder, query } from '../lib/db.js';

export const orderRouter = express.Router();

async function showOrders(req, res) {
	const q = 'SELECT * FROM orders';
	try {
		const queryResult = await query(q);
		if (queryResult.rowCount > 0) return res.send(queryResult.rows);
		else return res.send({ rows: 'no orders currently in the database' });
	} catch (error) {}
}

async function newOrder(req, res, next) {
	const queryResult = await query(
		'INSERT INTO orders DEFAULT VALUES RETURNING *'
	);
	if (queryResult.rowCount > 0 && queryResult.rows) {
		req.orderid = queryResult.rows[0].order_id;
		next();
	} else {
		console.error('error while creating new order');
		return res.send({
			result: 'failed to create new order, please try again',
		});
	}
}

async function setOrderStatus(req, res, next) {
	const orderid = req.orderid;
	const q = 'INSERT INTO orderstatus (orderid) VALUES ($1)';

	try {
		await query(q, [orderid]);
		next();
	} catch (error) {
		console.error('failed to set 0 status on order ' + orderid, error);
		return res.send({
			result: 'an error occured while creating new order, please try again',
		});
	}
}

async function fillOrder(req, res) {
	const { cartid } = req.body;
	const orderid = req.orderid;
	const q =
		'INSERT INTO orderline (itemid, num, orderid) SELECT itemid,num,$1 FROM cartline WHERE cartid = $2 RETURNING *';
	const v = [orderid, cartid];

	try {
		const queryResult = await query(q, v);
		const orderQuery = await query(
			'SELECT status FROM orderstatus WHERE orderid = $1',
			[orderid]
		);
		if (queryResult.rows && queryResult.rowCount > 0) {
			await query('DELETE FROM cartline WHERE cartid = $1', [cartid]);
			await query('DELETE FROM cart WHERE cart_id = $1', [cartid]);
			return res.send({
				result: 'order succesfully created',
				orderid: orderid,
				order: queryResult.rows,
				status: orderQuery.rows[0].status,
			});
		} else {
			await query('DELETE orders WHERE order_id = $1'[orderid]);
			return res.send({
				result: 'failed to create order, please try again',
			});
		}
	} catch (error) {
		console.error('failed to insert into order ' + orderid, error);
		return res.send({
			result: 'an error occured while trying to create an order, please try again',
		});
	}
}

async function showSingleOrder(req, res) {
	const { id } = req.params;
	const q1 = 'select * from orders where order_id = $1';
	const queryResultOrder = await query(q1, [id]);

	let price = 0;

	const q2 = `select 
    menuitems.id,menuitems.title,menuitems.price,orderline.num
    from orderline
    INNER JOIN menuitems ON orderline.itemid=menuitems.id
    WHERE orderid = $1`;
	const queryResultLines = await query(q2, [id]);

	queryResultLines.rows.forEach((i) => {
		price += i.num * i.price;
	});

	const q3 = 'select status, updated from orderstatus where orderid = $1';
	const queryResultStatus = await query(q3, [id]);

	return res.send({
		order: queryResultOrder.rows,
		items: queryResultLines.rows,
		'price of cart': price,
		"order status": queryResultStatus.rows[0],
	});
}


async function showOrderStatus(req, res) {
	const {id } = req.params;
	const q = 'SELECT status,updated FROM orderstatus WHERE orderid = $1';

	try {
		const queryResult = await query(q,[id]);
		if (queryResult.rows && queryResult.rowCount === 1) return res.send(queryResult.rows);
		else return res.send({result:'failed to get order status, please check id and try again'})
	} catch (error) {
		console.error('error occured while getting order, ' + id + ', status',error);
		return res.send({return:'error occured while getting status please check id and try again'})
	}
}
async function updateOrderStatus(req, res) {
	const {id } = req.params;
	const q = 'UPDATE orderstatus SET status = status+1, updated = DEFAULT WHERE orderid = $1 RETURNING *';

	try {
		const queryResult = await query(q,[id]);
		if (queryResult.rows && queryResult.rowCount === 1) return res.send(queryResult.rows);
		else return res.send({result:'failed to update order status, please check id and try again'})
	} catch (error) {
		console.error('error occured while updating order, ' + id + ', status',error);
		return res.send({return:'error occured while getting status please check id and try again'})
	}
}

orderRouter.get('/', showOrders);
orderRouter.post('/', doesExistCart, newOrder, setOrderStatus, fillOrder);

orderRouter.get('/:id', doesExistSingleOrder, showSingleOrder);


orderRouter.get('/:id/status', doesExistSingleOrder, showOrderStatus);
orderRouter.patch('/:id/status', doesExistSingleOrder, updateOrderStatus);

orderRouter.get('/:id/status', showOrderStatus);
orderRouter.patch('/:id/status', updateOrderStatus);


// const ws = new WebSocket('ws://')