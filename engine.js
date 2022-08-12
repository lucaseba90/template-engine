function Render() {
	this.format = {
		number: function(num) {
			return '$' + num;
		},
		date: function(date) {
			return new Date(date).toISOString()
													 .slice(0, 10)
													 .split('-')
													 .reverse()
													 .join('/')
		}
	}
}

const template = `
	<h1>
		<$print titlee || default: Sin titulo || format: number >
	</h1>

	<$if tituloGeneral>
		<span>Aca va el titulo general</span>
		<span>Es este: <$print tituloGeneral></span>
		<br>
	</$if>

	<$for a in arts>
		<span><$print a.nombre></span>
		<span><$print a._index></span>
		<span><$print a._key></span>
		<br>
	</$for>

	<ul>
		<$for item in articulos>
			
			<h2><$print item.nombre></h2>
			
			<$for cat in item.categorias>
				<span><$print cat.nombre || default: Sin categoria></span>
			</$for>
		</$for>
	</ul>
`

Render.prototype.getOpenCloseMatch = function(tpl, regExpOpen, regExpClose) {
	regExpOpen.lastIndex = 0;
	regExpClose.lastIndex = 0;
	const openMatch = regExpOpen.exec(tpl);
	var closeMatch = regExpClose.exec(tpl);

	var nextMatch = regExpOpen.exec(tpl);

	while(nextMatch && nextMatch.index < closeMatch.index) {
		nextMatch = regExpOpen.exec(tpl);
		closeMatch = regExpClose.exec(tpl);
	}

	return {
		open: openMatch,
		close: closeMatch
	}
}

Render.prototype.print = function(tpl, data) {
	const self = this;

	const regExp = new RegExp(/\<\$print.*?\>/g),
				match = regExp.exec(tpl);

	const keys = match[0].replace('<$print', '')
											 .replace('>', '')
											 .split('||')
											 .map(function(key) { 
													return key.trim();
												});

	const _default = keys.filter(function(key) {
		return key.indexOf('default:') > -1;
	}).pop();

	const format = keys.filter(function(key) {
		return key.indexOf('format:') > -1;
	}).pop();

	var dataKey;
	
	keys.forEach(function(key) {
		if(dataKey) { return; }
		for(var i = 0; i < data.length; i++) {
			dataKey = data[i];
			
			
			key.split('.').forEach(function(_key) {
				if(!dataKey) { return; }
				dataKey = dataKey[_key];
			});

			if(dataKey) { break; }
		}
	});

	

	if(!dataKey && _default) {
		dataKey = _default.replace('default:', '')
											.trim();
	}

	if(format) {
		const _format = format.replace('format:', '')
													.trim();

		dataKey = self.format[_format](dataKey);
	}

	var start = tpl.substring(0, match.index),
			end = tpl.substring(match.index + match[0].length);

	if(!dataKey) {
		dataKey = '';
	}

	tpl = start + dataKey + end;
	return tpl;
}

Render.prototype.for = function(tpl, data) {
	const self = this;

	const openRegExp = new RegExp(/\<\$for.*\>/g),
				closeRegExp = new RegExp(/\<\/\$for.*\>/g);

	const matchs = self.getOpenCloseMatch(tpl, openRegExp, closeRegExp);

	const keys = matchs.open[0].replace('in', '')
														 .replace('<$for', '')
														 .replace('>', '')
														 .split(' ')
														 .filter(Boolean);

	const itemName = keys[0],
				objectKey = keys[1];

	var dataKey;
	
	for(var i = 0; i < data.length; i++) {
		dataKey = data[i];
		objectKey.split('.').forEach(function(_key) {
			if(!dataKey) { return; }
			dataKey = dataKey[_key];
		});

		if(dataKey) { break; }
	}

	if(!dataKey) {
		return (
			tpl.substring(0, matchs.open.index) + ''
			+ tpl.substring(matchs.close.index + matchs.close[0].length)
		);
	}

	if(!Array.isArray(dataKey)) {
		dataKey = Object.keys(dataKey).map(function(key) {
			var obj = dataKey[key];
					obj._key = key;

			return obj;
		});
	}

	const repeatTpl = tpl.slice(
											matchs.open.index + matchs.open[0].length, 
											matchs.close.index
										);

	const result = dataKey.reduce(function(acc, _data, idx) {
		_data._index = idx + '';
		const itemData = {
						[itemName]: _data
					};

		acc.push(self.run(repeatTpl, [itemData].concat(data)));
		return acc;
	}, []);

	return (
		tpl.substring(0, matchs.open.index) + result.join('')
		+ tpl.substring(matchs.close.index + matchs.close[0].length)
	);
}

Render.prototype.if = function(tpl, data) {
	const self = this;
	
	const openRegExp = new RegExp(/\<\$if.*?\>/g),
				closeRegExp = new RegExp(/\<\/\$if.*\>/g);

	const matchs = self.getOpenCloseMatch(tpl, openRegExp, closeRegExp);

	const keys = matchs.open[0].replace('<$if', '')
													 .replace('>', '')
													 .split('||')
													 .map(function(key) {
															return key.trim();
													 })

	var value = keys.map(function(key) {
		var keyValues = key.split('&&').map(function(k) {
			const isNegated = k.indexOf('!') > -1;
			k = k.trim().replace('!', '');
			
			var dataKey;
			for(var i = 0; i < data.length; i++) {
				dataKey = data[i];
				k.split('.').forEach(function(_k) {
					if(!dataKey) { return; }
					dataKey = dataKey[_k];
				});

				if(!isNegated && dataKey) {
					return true;
				}
			}
			
			if(isNegated && !dataKey) {
				return true;
			}

			return false;
		});

		return keyValues.every(Boolean);
	}).indexOf(true);

	if(value > -1) {
		return (
			tpl.substring(0, matchs.open.index) 
			+ 
				self.run(tpl.slice(
							matchs.open.index + matchs.open[0].length,
							matchs.close.index
						), data)
			+ 
			tpl.substring(matchs.close.index + matchs.close[0].length)
		);
	}

	return (
		tpl.substring(0, matchs.open.index) + 
		tpl.substring(matchs.close.index + matchs.close[0].length)
	)
}

Render.prototype.run = function(tpl, data) {
	const regExp = new RegExp(/\<\$.*\>/g);
	var _data = JSON.parse(JSON.stringify(data));
	if(!Array.isArray(_data)) { _data = [_data] }
	var match = regExp.exec(tpl);
	while(match) {
		const command = match[0].slice(
													match[0].indexOf('$') + 1, 
													match[0].indexOf(' ')
												);

		tpl = this[command](tpl, _data);

		regExp.lastIndex = 0;
		match = regExp.exec(tpl);
	}
	return tpl.replace(/(\r\n|\n|\r|\t)/gm, '');
}