var parse = require('esprima').parse;
var inject = require('./Inject');

var Parser = function (code) {

  var parsedCode = parse(code);
  var programBody = parsedCode.body;

  var traverse = function (body) {

    for (var index = 0; index < body.length; index++) {
      var node = body[index];

      if (node.type === 'VariableDeclaration') {

        var declarationType = node.declarations[0].init.type;

        // Check for special declaration of function.
        // If so, push the function into the call stack and traverse the body of the function
        if (declarationType === 'FunctionExpression') {
          var name = node.declarations[0].id.name;
          var functionBody = node.declarations[0].init.body
          var params = node.declarations[0].init.params;
          
          functionStack.push(name);
          // Inject a function variable watcher after the declaration
          body.splice(index + 1, 0, inject.function(node));
          // Inject invocation and parameter watchers inside the function body 
          inject.invoke(functionBody, name, params);
          
          traverse(functionBody.body);
          functionStack.pop();
        } 


        // Check for special declaration of an object.
        else if (declarationType === 'ObjectExpression') {

          var objName = node.declarations[0].id.name;
          var properties = node.declarations[0].init.properties;
          
          var traverseObjectProperties = function (properties, objName) {


            for (var i = 0; i < properties.length; i++) {
              var property = properties[i];
              var keyName = objName + '.' + property.key.name;
              
              if (property.value.type === 'FunctionExpression') {


                var functionBody = property.value.body;
                var params = property.value.params;

                functionStack.push(keyName);

                // Inject invocation and parameter watchers inside the function body 
                inject.method(functionBody, keyName, params);
                traverse(functionBody.body);

                functionStack.pop();
              } else if (property.value.type === 'ObjectExpression') {
                traverseObjectProperties(property.value.properties, keyName);
              }
            }
          }

          traverseObjectProperties(properties, objName);

          body.splice(index + 1, 0, inject.object(node));
          index++;
        }

        // Else regular variable declaration
        else { 
          body.splice(index + 1, 0, inject.variable(node));
          index++;
        }
        
      }

      if (node.type === 'ForStatement') {
        body.splice(index, 0, inject.forLoopInit(node, 'for'));
        body.splice(index + 1, 0, inject.loopOpen(node, 'for'));
        body.splice(index + 3, 0, inject.loopClose(node, 'for'));
        body.splice(index + 4, 0, inject.loopSet(node, 'for'));
        index += 4;
      }

      if (node.type === 'WhileStatement') {
        body.splice(index, 0, inject.loopOpen(node, 'while'));
        body.splice(index + 2, 0, inject.loopClose(node, 'while'));
        index += 2;
      }

      if (node.type === 'DoWhileStatement') {
        body.splice(index, 0, inject.loopOpen(node, 'do'));
        body.splice(index + 2, 0, inject.loopClose(node, 'do'));
        index += 2;
      }

      if (node.type === 'ReturnStatement') {
        body.splice(index, 0, inject.returnState(node));
        body.splice(index + 1, 0, inject.return(node, functionStack[functionStack.length - 1]));
        index += 2;
      }


      if (node.type === 'ExpressionStatement') {

        if (node.expression.type === 'UpdateExpression') {
          body.splice(index + 1, 0, inject.expression(node) );
          index++;
        }

        else if (inject.isNotInjectedFunction(node)) {
          // Check for special declaration of function.
          // If so, push the function into the call stack and traverse the body of the function
          if (node.expression.right.type === 'FunctionExpression') {

            if (node.expression.left.object) {
              var name = inject.traverseMemberExpression(node.expression.left);
            } else { 
              var name = node.expression.left.name;
            }

            var functionBody = node.expression.right.body
            var params = node.expression.right.params;
            
            functionStack.push(name);
            // Inject a function variable watcher after the declaration

            if (node.expression.left.object) {
              // body.splice(index + 1, 0, inject.function(node));
            } else {
              body.splice(index + 1, 0, inject.function(node));
            }
            // Inject invocation and parameter watchers inside the function body 
            inject.invoke(functionBody, name, params);
            
            traverse(functionBody.body);
            functionStack.pop();
          }   

          if (node.expression.left.type === 'MemberExpression') {
            body.splice(index + 1, 0, inject.memberExpression(node) );
            index++;
          } 
          else {
            body.splice(index + 1, 0, inject.expression(node) );
            index++;
          }

          if (node.expression.right.type === 'ObjectExpression') {
            body.splice(index + 1, 0, inject.object(node) );
            index++; 
          } 

        }
      }

      if (node.type === 'IfStatement') {
        body.splice(index, 0, inject.ifStart(node) );
        body.splice(index + 2, 0, inject.ifEnd(node) );
        index++;

        // Traverse if statement tree
        var traverseIf = function (node) {
          if (node.consequent) {
            if (node.consequent.body) {
              var block = node.consequent;
              traverse(block.body);
            }
          }
          if (node.alternate) {
            if (node.alternate.body) {
              var block = node.alternate;
              traverse(block.body);
            } else {
              var block = node.alternate;
              traverseIf(block);
            }
          }
        }
        traverseIf(node);
      }
      // Traverse loop bodies
      if (node.body) {
        var block = node.body;
        traverse(block.body);
      }
    }
  }

  traverse(programBody);

  return parsedCode;
}

// External variable to help manage tracking of function invocations
var functionStack = [];

module.exports = Parser;