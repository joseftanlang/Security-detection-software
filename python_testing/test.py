import requests
from Crypto.Util.number import long_to_bytes
import os
admin_token = '29rhufsd93rqo8ehf9283oheqi'#os.environ['ADMIN_TOKEN']

apipath = "http://localhost:2026/api/"

i1 = requests.get(apipath+"newidentity").json()
i1c = requests.post(apipath+"recoveridentity", json={"privateKey":i1['privateKey']}).json()  
i2 = requests.get(apipath+"newidentity").json()
i3 = requests.get(apipath+"newidentity").json()

g1name = 'a' 
g2name = 'b' 
g3name = 'c'
print("MAKING GROUP {}:".format(g1name), requests.get(apipath+"newgroup", {'groupName': g1name, 'admin_token': admin_token}).json())
print("MAKING GROUP {}:".format(g2name), requests.get(apipath+"newgroup", {'groupName': g2name, 'admin_token': admin_token}).json())
print("MAKING GROUP {}:".format(g3name), requests.get(apipath+"newgroup", {'groupName': g3name, 'admin_token': admin_token}).json())
print("IF GETTING ROOT FROM EMPTY GROUP:", requests.get(apipath+"grouproot?groupName="+str(g1name)).json())

# add i1 and i3 to g1name
print("\nCHECK ADDING TO GROUP")
requests.post(apipath+"addtogroup", json={"groupName": g1name, "commitment": i1['commitment']})
requests.post(apipath+"addtogroup", json={"groupName": g1name, "commitment": i1['commitment']})
requests.post(apipath+"addtogroup", json={"groupName": g1name, "commitment": i1['commitment']})
requests.get(apipath+"nextbatch?groupName="+str(g1name), {'admin_token': admin_token}) 
print("MULTIPLE TIMES ADD MEMBER 1 ROOT:", requests.get(apipath+"grouproot?groupName="+str(g1name)).json())

requests.post(apipath+"addtogroup", json={"groupName": g1name, "commitment": i1['commitment']})
requests.post(apipath+"addtogroup", json={"groupName": g1name, "commitment": i3['commitment']})
requests.get(apipath+"nextbatch?groupName="+str(g1name), {'admin_token': admin_token}) 
print("ROOT WITH MEMBER 1 AND 3:", requests.get(apipath+"grouproot?groupName="+str(g1name)).json())

print("\nVALIDATE GROUP CHECKING:") 
idx1 = requests.get(apipath+"getgroupidx?groupName={}&commitment={}".format(g1name, i1c['commitment']), 
                    {'admin_token': admin_token}).json()['idx'] # hehe i1 copy 
print("NOT IN GROUP:", requests.get(apipath+"getgroupidx?groupName={}&commitment={}".format(g1name, i2['commitment']),
                                    {'admin_token': admin_token}).json()) 
idx3 = requests.get(apipath+"getgroupidx?groupName={}&commitment={}".format(g1name, i3['commitment']),
                    {'admin_token': admin_token}).json()['idx'] 

# get merkle proof for idx3
print("\nCHECKING MERKLE PROOF") 
mp1 = requests.get(apipath+"getmerkleproof?groupName={}&commitment={}".format(g1name, i1['commitment'])).json() 
mp3 = requests.get(apipath+"getmerkleproof?groupName={}&commitment={}".format(g1name, i3['commitment'])).json() 
print("THIS SHOULD HAVE", i1['commitment']) 
print(mp3['siblings'])

# indeed, we see that both have a shared sibling that is i1['commitment'] so it's correct structure 
print("\nCOMPOSING MESSAGE") 
pr1 = {"merkleProof": mp1, "privateKey":i1['privateKey'],
       "message": "hello world", "scope": 103897}
proof1 = requests.post(apipath+"generateproof", json=pr1).json() 
print("HELLO WORLD MESSAGE:", repr(long_to_bytes(int(proof1['message']))))
print("FULL PROOF:", proof1)

ver = requests.post(apipath+"verifyproof", json={ "proof": proof1, "groupName": g1name}).json()
print("VERIFIED:", ver)

# add i2 to group and see if it still verifies
print("\nUPDATE BATCH AND EXPIRE PROOF AND TRY AGAIN") 
print("AFT ADD i2 TO GROUP TOO BUT OLD PROOF:", requests.get(apipath+"grouproot?groupName="+str(g1name)).json())
requests.post(apipath+"addtogroup", json={"groupName": g1name, "commitment": i1['commitment']})
requests.post(apipath+"addtogroup", json={"groupName": g1name, "commitment": i2['commitment']})
requests.post(apipath+"addtogroup", json={"groupName": g1name, "commitment": i3['commitment']})
requests.get(apipath+"nextbatch?groupName="+str(g1name)) 
ver = requests.post(apipath+"verifyproof", json={ "proof": proof1, "groupName": g1name}).json()
print("VERIFIED:", ver)
